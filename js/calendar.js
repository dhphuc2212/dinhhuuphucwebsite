window.GoogleCalendarManager = (function () {
  const GOOGLE_CLIENT_ID = "645926964017-6hqgk9jf1umh6qu1tc6vu0ec5c233pta.apps.googleusercontent.com";
  const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";
  const H = window.CalendarHelpers;

  let sessionId = localStorage.getItem("dhp_gcal_sid") || "";
  let accessToken = "";
  let userEmail = localStorage.getItem("dhp_gcal_email") || "";
  let expiresAtMs = Number(localStorage.getItem("dhp_gcal_exp") || "0") || 0;
  let refreshTimer = null;
  let liveTickTimer = null;
  let ongoingRefreshPromise = null;

  let selectedDateStr = H.getTodayStr();
  let hideBirthdays = true;
  let cachedEvents = [];
  let editingEventId = null;
  let checklistState = JSON.parse(localStorage.getItem("dhp_gcal_tasks") || "{}");
  let eventDoneState = JSON.parse(localStorage.getItem("dhp_gcal_done") || "{}");

  function notify(msg) {
    if (typeof window.showToast === "function") {
      window.showToast(msg);
    }
  }

  function getRemember60() {
    const cb = document.getElementById("remember60DaysCheckbox");
    return cb ? Boolean(cb.checked) : true;
  }

  function persistCache() {
    try {
      if (sessionId) localStorage.setItem("dhp_gcal_sid", sessionId);
      else localStorage.removeItem("dhp_gcal_sid");

      if (userEmail) localStorage.setItem("dhp_gcal_email", userEmail);
      else localStorage.removeItem("dhp_gcal_email");

      if (expiresAtMs) localStorage.setItem("dhp_gcal_exp", String(expiresAtMs));
      else localStorage.removeItem("dhp_gcal_exp");
    } catch {}
  }

  function saveChecklist() {
    try {
      localStorage.setItem("dhp_gcal_tasks", JSON.stringify(checklistState));
    } catch {}
  }

  function saveDoneState() {
    try {
      localStorage.setItem("dhp_gcal_done", JSON.stringify(eventDoneState));
    } catch {}
  }

  function scheduleAutoRefresh(expiresInSec = 3500) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    const delayMs = Math.max(15000, (Number(expiresInSec) - 120) * 1000);
    refreshTimer = setTimeout(() => {
      refreshSession({ reload: false });
    }, delayMs);
  }

  function startLiveClock() {
    if (liveTickTimer) clearInterval(liveTickTimer);
    liveTickTimer = setInterval(() => {
      if (selectedDateStr === H.getTodayStr() && cachedEvents.length > 0 && !editingEventId) {
        renderAgenda();
      }
    }, 60000);
  }

  async function refreshSession({ reload = false, retryCount = 0 } = {}) {
    if (ongoingRefreshPromise) return ongoingRefreshPromise;

    ongoingRefreshPromise = (async () => {
      try {
        sessionId = localStorage.getItem("dhp_gcal_sid") || sessionId;
        const headers = {};
        if (sessionId) headers["X-Session-Id"] = sessionId;

        const res = await fetch("/api/auth/refresh", {
          credentials: "include",
          cache: "no-store",
          headers
        });
        if (!res.ok) return null;
        const data = await res.json();

        if (data.authenticated && data.accessToken) {
          accessToken = data.accessToken;
          userEmail = data.email || userEmail || "Tài khoản Google";
          expiresAtMs = Number(data.expiresAtMs) || 0;
          persistCache();
          syncUI();
          scheduleAutoRefresh(data.expiresIn || 3600);

          if (reload || document.getElementById("calendarEventsContainer")) {
            await loadEvents({ skipRefresh: true });
          }
          return accessToken;
        }

        if (sessionId && data.reason === "session_not_found" && retryCount < 2) {
          ongoingRefreshPromise = null;
          await new Promise((r) => setTimeout(r, 1200));
          return refreshSession({ reload, retryCount: retryCount + 1 });
        }

        if (data.reason === "expired" || data.reason === "revoked") {
          sessionId = "";
          accessToken = "";
          userEmail = "";
          expiresAtMs = 0;
          persistCache();
          syncUI();
        }
      } catch {}

      return null;
    })();

    try {
      return await ongoingRefreshPromise;
    } finally {
      ongoingRefreshPromise = null;
    }
  }

  function login() {
    const remember60 = getRemember60() ? "1" : "0";
    window.location.assign(`/api/auth/google/start?remember60=${remember60}`);
  }

  async function logout() {
    if (refreshTimer) clearTimeout(refreshTimer);
    if (liveTickTimer) clearInterval(liveTickTimer);

    const oldSid = sessionId;
    sessionId = "";
    accessToken = "";
    userEmail = "";
    expiresAtMs = 0;
    cachedEvents = [];
    editingEventId = null;
    persistCache();
    syncUI();

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: oldSid ? { "X-Session-Id": oldSid } : {}
      });
    } catch {}

    notify("Đã đăng xuất Google Calendar.");
  }

  function syncUI() {
    const headerArea = document.getElementById("headerAuthArea");
    const cardControls = document.getElementById("calendarAuthControls");
    const userBar = document.getElementById("calendarUserBar");
    const emailLabel = document.getElementById("loggedUserEmail");
    const container = document.getElementById("calendarEventsContainer");
    const isLoggedIn = Boolean(accessToken || (sessionId && expiresAtMs > Date.now()));

    if (isLoggedIn) {
      if (headerArea) {
        headerArea.innerHTML = `
          <span class="status-pill">${H.escapeHtml(userEmail || "Đã đăng nhập")}</span>
          <button type="button" id="headerLogoutBtn" class="btn btn-outline btn-sm">Đăng xuất</button>`;
      }
      if (cardControls) cardControls.classList.add("hidden");
      if (userBar) userBar.classList.remove("hidden");
      if (emailLabel) {
        const expSuffix = expiresAtMs
          ? ` • Duy trì tới ${new Date(expiresAtMs).toLocaleDateString("vi-VN")}`
          : "";
        emailLabel.textContent = (userEmail || "Tài khoản Google") + expSuffix;
      }
    } else {
      if (headerArea) {
        headerArea.innerHTML = `
          <button type="button" id="googleLoginHeaderBtn" class="btn btn-outline btn-sm hover-arrow">
            <span>Đăng nhập Google</span>
            <span class="arrow">→</span>
          </button>`;
      }
      if (cardControls) cardControls.classList.remove("hidden");
      if (userBar) userBar.classList.add("hidden");
      if (container) {
        container.innerHTML = `
          <div class="calendar-empty-state">
            Chưa đăng nhập tài khoản Google. Bấm <strong>"Đăng nhập với Google để xem lịch"</strong> để kết nối và hiển thị lịch làm việc của riêng bạn.
          </div>`;
      }
    }
  }

  async function patchGoogleEvent(eventId, payload) {
    if (!accessToken) await refreshSession({ reload: false });
    if (!accessToken) {
      notify("Bạn cần đăng nhập Google trước khi cập nhật lịch trình.");
      return null;
    }

    const endpoint = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
    let res = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      const refreshedToken = await refreshSession({ reload: false });
      if (refreshedToken) {
        res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${refreshedToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      }
    }

    if (!res.ok) return null;
    return await res.json();
  }

  async function updateEvent(eventId, { title, date, startTime, endTime, description }) {
    const startDate = date || selectedDateStr;
    const sTime = H.normalizeTime(startTime, "09:00");
    const eTime = H.normalizeTime(endTime, "10:00");

    const payload = {
      summary: title || "Lịch làm việc",
      description: description ?? "",
      start: { dateTime: `${startDate}T${sTime}:00+07:00`, timeZone: "Asia/Ho_Chi_Minh" },
      end: { dateTime: `${startDate}T${eTime}:00+07:00`, timeZone: "Asia/Ho_Chi_Minh" }
    };

    const updated = await patchGoogleEvent(eventId, payload);
    if (!updated) {
      notify("Không thể cập nhật sự kiện trên Google Calendar.");
      return false;
    }

    editingEventId = null;
    selectedDateStr = startDate;
    notify("Đã lưu thay đổi lên Google Calendar!");
    await loadEvents({ skipRefresh: true });
    return true;
  }

  async function toggleEventDone(eventId, isDone) {
    eventDoneState[eventId] = isDone;
    saveDoneState();

    const ev = cachedEvents.find((item) => item.id === eventId);
    if (ev) {
      const cleanSummary = (ev.summary || "").replace(/^✅\s*/, "");
      const newSummary = isDone ? `✅ ${cleanSummary}` : cleanSummary;
      ev.summary = newSummary;

      await patchGoogleEvent(eventId, {
        summary: newSummary,
        extendedProperties: {
          private: { dhpDone: isDone ? "1" : "0" }
        }
      });
    }

    notify(isDone ? "Đã đánh dấu hoàn thành công việc." : "Đã chuyển về chưa hoàn thành.");
    await renderAgenda();
  }

  async function deleteEvent(eventId, title = "") {
    if (!eventId) return false;
    if (!accessToken) await refreshSession({ reload: false });
    if (!accessToken) {
      notify("Bạn cần đăng nhập Google trước khi xóa lịch trình.");
      return false;
    }

    const ok = window.confirm(`Xóa lịch trình "${title || "này"}" khỏi Google Calendar?`);
    if (!ok) return false;

    try {
      const endpoint = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
      let res = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (res.status === 401) {
        const refreshedToken = await refreshSession({ reload: false });
        if (refreshedToken) {
          res = await fetch(endpoint, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${refreshedToken}` }
          });
        }
      }

      if (res.status === 204 || res.ok) {
        delete checklistState[eventId];
        delete eventDoneState[eventId];
        saveChecklist();
        saveDoneState();
        if (editingEventId === eventId) editingEventId = null;
        notify("Đã xóa lịch trình khỏi Google Calendar.");
        await loadEvents({ skipRefresh: true });
        return true;
      }

      const errData = await res.json().catch(() => ({}));
      const reason = errData?.error?.message || "";
      if (reason.toLowerCase().includes("birthday") || res.status === 403 || res.status === 400) {
        notify("Không thể xóa sự kiện sinh nhật đồng bộ tự động từ Danh bạ Google.");
      } else {
        notify(`Không thể xóa lịch trình (${res.status}).`);
      }
      return false;
    } catch {
      notify("Lỗi mạng khi xóa lịch trình.");
      return false;
    }
  }

  function isEventCompleted(ev) {
    if (typeof eventDoneState[ev.id] === "boolean") return eventDoneState[ev.id];
    if (ev.extendedProperties?.private?.dhpDone === "1") return true;
    if ((ev.summary || "").startsWith("✅ ")) return true;
    return false;
  }

  function toInputTime(dateObj) {
    return `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
  }

  function toInputDate(dateObj) {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(
      dateObj.getDate()
    ).padStart(2, "0")}`;
  }

  async function renderAgenda() {
    const container = document.getElementById("calendarEventsContainer");
    if (!container) return;

    const weatherInfo = await H.fetchWeatherForDate(selectedDateStr);
    const isToday = selectedDateStr === H.getTodayStr();
    const nowMs = Date.now();

    const allDayItems = [];
    const timedItems = [];

    cachedEvents.forEach((ev) => {
      const isBirthday =
        ev.eventType === "birthday" ||
        /birthday|sinh nhật|chúc mừng sinh nhật/i.test(ev.summary || "");
      if (hideBirthdays && isBirthday) return;

      if (ev.start?.date && !ev.start?.dateTime) {
        allDayItems.push({ ...ev, isBirthday });
      } else if (ev.start?.dateTime) {
        const startDt = new Date(ev.start.dateTime);
        const endDt = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(startDt.getTime() + 3600000);
        timedItems.push({ ...ev, startDt, endDt, isBirthday });
      }
    });

    timedItems.sort((a, b) => a.startDt - b.startDt);

    const completedCount = timedItems.filter((item) => isEventCompleted(item)).length;
    const summaryText = `Hoàn thành: ${completedCount}/${timedItems.length} đầu việc`;

    let html = `
      <div class="dhp-agenda-wrap">
        <div class="dhp-day-toolbar">
          <div class="dhp-nav-group">
            <button type="button" class="btn btn-outline btn-sm" id="calPrevDayBtn">← Hôm qua</button>
            <div class="dhp-date-title-box">
              <span>${H.escapeHtml(H.formatDisplayDate(selectedDateStr))}</span>
              <input type="date" id="calDatePickerInput" class="dhp-date-picker" value="${selectedDateStr}" title="Chọn ngày bất kỳ" />
            </div>
            ${!isToday ? `<button type="button" class="btn btn-outline btn-sm" id="calTodayBtn">Về hôm nay</button>` : ""}
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="calNextDayBtn">Ngày mai →</button>
        </div>

        <div class="dhp-sub-toolbar">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
            <label class="dhp-toggle-label">
              <input type="checkbox" id="calHideBirthdayToggle" ${hideBirthdays ? "checked" : ""} />
              <span>Ẩn ngày lễ & sinh nhật</span>
            </label>
            <span>• <strong>${H.escapeHtml(summaryText)}</strong></span>
          </div>
          ${weatherInfo ? `<div class="dhp-weather-pill">${H.escapeHtml(weatherInfo.summary)}</div>` : ""}
        </div>
    `;

    if (allDayItems.length > 0) {
      html += `<div class="dhp-allday-strip"><span style="font-weight:600;color:#475569;">Cả ngày:</span>`;
      allDayItems.forEach((ev) => {
        const icon = ev.isBirthday ? "🎂" : "📌";
        html += `<span class="dhp-allday-pill">${icon} ${H.escapeHtml(ev.summary || "Sự kiện cả ngày")}</span>`;
      });
      html += `</div>`;
    }

    if (timedItems.length === 0) {
      html += `
        <div class="calendar-empty-state" style="margin-top:4px;">
          Không có lịch làm việc theo khung giờ trong ngày <strong>${H.escapeHtml(
            H.formatDisplayDate(selectedDateStr)
          )}</strong>.
          <div style="margin-top:8px;">
            <button type="button" class="dhp-quick-add-btn" data-quick-time="09:00">+ Nhắn AI để lên lịch cho ngày này</button>
          </div>
        </div>
      </div>`;
      container.innerHTML = html;
      return;
    }

    html += `<div class="dhp-timeline-list">`;
    let nowDividerInserted = false;

    timedItems.forEach((ev, idx) => {
      const startMs = ev.startDt.getTime();
      const endMs = ev.endDt.getTime();
      const done = isEventCompleted(ev);

      if (isToday && !nowDividerInserted && nowMs < startMs) {
        const nowStr = new Date(nowMs).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        html += `
          <div class="dhp-now-divider">
            <div class="dhp-now-label">Bây giờ ${nowStr}</div>
            <div style="display:flex;justify-content:center;"><span style="width:8px;height:8px;border-radius:50%;background:#dc2626;"></span></div>
            <div class="dhp-now-line"></div>
          </div>`;
        nowDividerInserted = true;
      }

      let stateClass = "is-upcoming";
      if (done) {
        stateClass = "is-past is-done";
      } else if (isToday) {
        if (nowMs >= endMs) stateClass = "is-past";
        else if (nowMs >= startMs && nowMs < endMs) {
          stateClass = "is-now";
          nowDividerInserted = true;
        }
      } else if (selectedDateStr < H.getTodayStr()) {
        stateClass = "is-past";
      }

      const startStr = ev.startDt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      const endStr = ev.endDt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      const durationStr = H.formatDuration(Math.round((endMs - startMs) / 60000));
      const cleanTitle = (ev.summary || "(Không có tiêu đề)").replace(/^✅\s*/, "");
      const cat = H.classifyEvent(cleanTitle, ev.description);
      const safeTitle = H.escapeHtml(cleanTitle);
      const safeId = H.escapeHtml(ev.id || "");
      const canModify = ev.eventType !== "birthday";
      const isEditing = editingEventId === ev.id;

      let statusBadge = "";
      if (done) {
        statusBadge = `<span class="dhp-badge dhp-badge-done">✓ Đã hoàn thành</span>`;
      } else if (stateClass === "is-now") {
        const minsLeft = Math.max(1, Math.round((endMs - nowMs) / 60000));
        statusBadge = `<span class="dhp-badge dhp-badge-now">🔥 ĐANG DIỄN RA • Còn ${minsLeft}p</span>`;
      } else if (isToday && stateClass === "is-upcoming") {
        const minsToStart = Math.round((startMs - nowMs) / 60000);
        if (minsToStart > 0 && minsToStart <= 120) {
          statusBadge = `<span class="dhp-badge dhp-badge-countdown">🔔 Diễn ra sau ${H.formatDuration(minsToStart)}</span>`;
        }
      }

      let rainWarning = "";
      if (!done && weatherInfo?.rainyHours?.length && /giao|kho|gặp|khách|đi|chuyển|xe|ngoài/i.test(cleanTitle)) {
        const sH = ev.startDt.getHours();
        const eH = ev.endDt.getHours();
        const hitRain = weatherInfo.rainyHours.some((h) => h >= sH && h <= eH);
        if (hitRain) {
          rainWarning = `<div class="dhp-rain-warn">⚠️ Dự báo có mưa vào khung giờ này, lưu ý kiểm tra lộ trình giao nhận.</div>`;
        }
      }

      const tasks = checklistState[ev.id] || [];
      const tasksHtml = tasks
        .map(
          (t, tIdx) => `
          <label class="dhp-subtask-item ${t.done ? "done" : ""}">
            <input type="checkbox" class="dhp-task-checkbox" data-event-id="${safeId}" data-task-idx="${tIdx}" ${
              t.done ? "checked" : ""
            } />
            <span>${H.escapeHtml(t.text)}</span>
          </label>`
        )
        .join("");

      const editFormHtml = isEditing
        ? `
          <div class="dhp-edit-box" data-edit-event-id="${safeId}">
            <input type="text" class="dhp-edit-input edit-title-input" value="${safeTitle}" placeholder="Tên công việc / sự kiện" />
            <div class="dhp-edit-grid">
              <input type="date" class="dhp-edit-input edit-date-input" value="${toInputDate(ev.startDt)}" />
              <input type="time" class="dhp-edit-input edit-start-input" value="${toInputTime(ev.startDt)}" />
              <input type="time" class="dhp-edit-input edit-end-input" value="${toInputTime(ev.endDt)}" />
            </div>
            <input type="text" class="dhp-edit-input edit-desc-input" value="${H.escapeHtml(
              ev.description || ""
            )}" placeholder="Ghi chú chi tiết (tùy chọn)" />
            <div class="dhp-edit-actions">
              <button type="button" class="btn btn-outline btn-sm cancel-edit-btn">Hủy</button>
              <button type="button" class="btn btn-primary btn-sm save-edit-btn" data-event-id="${safeId}">Lưu thay đổi</button>
            </div>
          </div>
        `
        : "";

      html += `
        <div class="dhp-tl-row ${stateClass}">
          <div class="dhp-tl-time">
            <div>${startStr} – ${endStr}</div>
            <span class="dhp-tl-dur">${done ? "Đã hoàn thành" : durationStr}</span>
          </div>
          <div class="dhp-tl-axis">
            <div class="dhp-tl-dot"></div>
            <div class="dhp-tl-line"></div>
          </div>
          <article class="dhp-tl-card ${cat.cls}">
            <div class="dhp-card-top">
              <div>
                <div class="dhp-badges">
                  <span class="dhp-badge ${cat.badgeCls}">${cat.label}</span>
                  ${statusBadge}
                </div>
                <div class="dhp-event-title-row">
                  ${
                    canModify
                      ? `<input type="checkbox" class="dhp-event-done-cb" data-event-id="${safeId}" title="Đánh dấu hoàn thành công việc" ${
                          done ? "checked" : ""
                        } />`
                      : ""
                  }
                  <div class="dhp-card-title">${safeTitle}</div>
                </div>
              </div>
              ${
                canModify
                  ? `<div class="dhp-card-actions">
                      <button type="button" class="btn btn-outline btn-sm edit-event-btn" data-event-id="${safeId}" style="padding:2px 9px;font-size:0.75rem;">Sửa</button>
                      <button type="button" class="btn btn-outline btn-sm delete-event-btn" data-event-id="${safeId}" data-event-title="${safeTitle}" style="padding:2px 9px;font-size:0.75rem;">Xóa</button>
                    </div>`
                  : ""
              }
            </div>
            ${editFormHtml}
            ${!isEditing && ev.description ? `<div class="dhp-card-desc">${H.escapeHtml(ev.description)}</div>` : ""}
            ${rainWarning}
            <div class="dhp-subtasks">
              ${tasksHtml}
              <button type="button" class="dhp-add-subtask" data-event-id="${safeId}">+ Thêm đầu việc chuẩn bị</button>
            </div>
          </article>
        </div>
      `;

      const nextEv = timedItems[idx + 1];
      if (nextEv) {
        const gapMins = Math.round((nextEv.startDt.getTime() - endMs) / 60000);
        if (gapMins >= 45) {
          const nextStartStr = nextEv.startDt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
          html += `
            <div class="dhp-free-slot">
              <div></div>
              <div class="dhp-tl-axis"><div class="dhp-tl-line"></div></div>
              <div class="dhp-free-banner">
                <span>Trống ${H.formatDuration(gapMins)} (${endStr} – ${nextStartStr})</span>
                <button type="button" class="dhp-quick-add-btn" data-quick-time="${endStr}">+ Thêm việc nhanh</button>
              </div>
            </div>
          `;
        }
      }
    });

    html += `</div></div>`;
    container.innerHTML = html;
  }

  async function loadEvents({ skipRefresh = false } = {}) {
    const container = document.getElementById("calendarEventsContainer");
    if (!container) return;

    if (!accessToken && !skipRefresh) {
      await refreshSession({ reload: false });
    }
    if (!accessToken) return;

    container.innerHTML = `<div class="calendar-empty-state">Đang tải lịch trình ngày ${H.escapeHtml(
      H.formatDisplayDate(selectedDateStr)
    )}...</div>`;

    try {
      const timeMin = `${selectedDateStr}T00:00:00+07:00`;
      const timeMax = `${selectedDateStr}T23:59:59+07:00`;

      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");

      let res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (res.status === 401) {
        const refreshedToken = await refreshSession({ reload: false });
        if (refreshedToken) {
          res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${refreshedToken}` }
          });
        } else {
          logout();
          notify("Phiên đăng nhập Google đã hết hạn, vui lòng đăng nhập lại.");
          return;
        }
      }

      const data = await res.json();
      cachedEvents = data.items || [];
      await renderAgenda();
      startLiveClock();
    } catch {
      container.innerHTML = `<div class="calendar-empty-state">Không thể tải sự kiện lúc này. Bạn thử bấm Làm mới lịch nhé.</div>`;
    }
  }

  async function createEvent(scheduleOrTitle, dateArg, startTimeArg, endTimeArg, descArg) {
    if (!accessToken) await refreshSession({ reload: false });
    if (!accessToken) {
      notify("Bạn cần đăng nhập Google trước khi lưu sự kiện lên Google Calendar!");
      login();
      return false;
    }

    const schedule =
      typeof scheduleOrTitle === "object" && scheduleOrTitle !== null
        ? scheduleOrTitle
        : {
            title: scheduleOrTitle,
            date: dateArg,
            startTime: startTimeArg,
            endTime: endTimeArg,
            description: descArg
          };

    const startDate = schedule.date || selectedDateStr || H.getTodayStr();
    const endDate = schedule.endDate || startDate;
    const startTime = H.normalizeTime(schedule.startTime, "09:00");
    const endTime = H.normalizeTime(schedule.endTime, "10:00");

    const startDateTime = `${startDate}T${startTime}:00+07:00`;
    const endDateTime = `${endDate}T${endTime}:00+07:00`;

    try {
      const payload = {
        summary: schedule.title || "Lịch làm việc",
        description: schedule.description || "Tạo tự động từ Trợ lý AI trên dinhhuuphuc.com",
        start: { dateTime: startDateTime, timeZone: "Asia/Ho_Chi_Minh" },
        end: { dateTime: endDateTime, timeZone: "Asia/Ho_Chi_Minh" }
      };

      let res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        const refreshedToken = await refreshSession({ reload: false });
        if (refreshedToken) {
          res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${refreshedToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
        }
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${res.status}`;
        notify(`Lỗi Google Calendar: ${msg}`);
        return false;
      }

      selectedDateStr = startDate;
      notify("Đã thêm lịch làm việc vào Google Calendar!");
      await loadEvents({ skipRefresh: true });
      return true;
    } catch {
      notify("Lỗi mạng khi lưu sự kiện lên Google Calendar.");
      return false;
    }
  }

  function handleRedirectParams() {
    if (window.location.hash && window.location.hash.includes("gcal_sid=")) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const newSid = hashParams.get("gcal_sid");
      const newEmail = hashParams.get("gcal_email") || "";
      const newExp = Number(hashParams.get("gcal_exp") || "0") || 0;
      if (newSid) {
        sessionId = newSid;
        userEmail = newEmail;
        expiresAtMs = newExp;
        persistCache();
      }
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal_ok") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      notify("Đã kết nối Google Calendar (duy trì 60 ngày)!");
    } else if (params.get("gcal_error")) {
      window.history.replaceState({}, "", window.location.pathname);
      notify("Đăng nhập Google không thành công: " + params.get("gcal_error"));
    }
  }

  document.addEventListener("click", (e) => {
    const loginBtn = e.target.closest("#googleLoginHeaderBtn, #googleLoginCardBtn");
    if (loginBtn) {
      e.preventDefault();
      login();
      return;
    }

    const logoutBtn = e.target.closest("#headerLogoutBtn, #googleLogoutBtn");
    if (logoutBtn) {
      e.preventDefault();
      logout();
      return;
    }

    const refreshBtn = e.target.closest("#refreshCalendarBtn");
    if (refreshBtn) {
      e.preventDefault();
      loadEvents();
      return;
    }

    if (e.target.closest("#calPrevDayBtn")) {
      editingEventId = null;
      selectedDateStr = H.shiftDateStr(selectedDateStr, -1);
      loadEvents();
      return;
    }

    if (e.target.closest("#calNextDayBtn")) {
      editingEventId = null;
      selectedDateStr = H.shiftDateStr(selectedDateStr, 1);
      loadEvents();
      return;
    }

    if (e.target.closest("#calTodayBtn")) {
      editingEventId = null;
      selectedDateStr = H.getTodayStr();
      loadEvents();
      return;
    }

    const editBtn = e.target.closest(".edit-event-btn");
    if (editBtn) {
      e.preventDefault();
      const targetId = editBtn.dataset.eventId;
      editingEventId = editingEventId === targetId ? null : targetId;
      renderAgenda();
      return;
    }

    if (e.target.closest(".cancel-edit-btn")) {
      e.preventDefault();
      editingEventId = null;
      renderAgenda();
      return;
    }

    const saveEditBtn = e.target.closest(".save-edit-btn");
    if (saveEditBtn) {
      e.preventDefault();
      const evId = saveEditBtn.dataset.eventId;
      const box = saveEditBtn.closest(".dhp-edit-box");
      if (box && evId) {
        saveEditBtn.disabled = true;
        saveEditBtn.textContent = "Đang lưu...";
        updateEvent(evId, {
          title: box.querySelector(".edit-title-input")?.value.trim(),
          date: box.querySelector(".edit-date-input")?.value,
          startTime: box.querySelector(".edit-start-input")?.value,
          endTime: box.querySelector(".edit-end-input")?.value,
          description: box.querySelector(".edit-desc-input")?.value.trim()
        });
      }
      return;
    }

    const delBtn = e.target.closest(".delete-event-btn");
    if (delBtn) {
      e.preventDefault();
      deleteEvent(delBtn.dataset.eventId, delBtn.dataset.eventTitle);
      return;
    }

    const quickAddBtn = e.target.closest(".dhp-quick-add-btn");
    if (quickAddBtn) {
      const timeStr = quickAddBtn.dataset.quickTime || "09:00";
      const chatInput = document.querySelector("#chatInput, #aiChatInput, .chat-input");
      if (chatInput) {
        const displayDmy = H.formatDisplayDate(selectedDateStr);
        chatInput.value = `Đặt lịch ${displayDmy} lúc ${timeStr}: `;
        chatInput.focus();
        chatInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const addSubtaskBtn = e.target.closest(".dhp-add-subtask");
    if (addSubtaskBtn) {
      const evId = addSubtaskBtn.dataset.eventId;
      const text = window.prompt("Nhập đầu việc nhỏ cần chuẩn bị cho lịch này:");
      if (text && text.trim()) {
        if (!checklistState[evId]) checklistState[evId] = [];
        checklistState[evId].push({ text: text.trim(), done: false });
        saveChecklist();
        renderAgenda();
      }
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "calDatePickerInput" && e.target.value) {
      editingEventId = null;
      selectedDateStr = e.target.value;
      loadEvents();
      return;
    }

    if (e.target.id === "calHideBirthdayToggle") {
      hideBirthdays = Boolean(e.target.checked);
      renderAgenda();
      return;
    }

    if (e.target.classList.contains("dhp-event-done-cb")) {
      const evId = e.target.dataset.eventId;
      toggleEventDone(evId, Boolean(e.target.checked));
      return;
    }

    if (e.target.classList.contains("dhp-task-checkbox")) {
      const evId = e.target.dataset.eventId;
      const idx = Number(e.target.dataset.taskIdx);
      if (checklistState[evId]?.[idx]) {
        checklistState[evId][idx].done = Boolean(e.target.checked);
        saveChecklist();
        renderAgenda();
      }
    }
  });

async function findMatchingEvent(targetTitle, targetDate) {
    const searchDate = targetDate || selectedDateStr || H.getTodayStr();
    if (selectedDateStr !== searchDate) {
      selectedDateStr = searchDate;
      await loadEvents({ skipRefresh: false });
    } else if (cachedEvents.length === 0) {
      await loadEvents({ skipRefresh: false });
    }

    const candidates = cachedEvents.filter((ev) => ev.eventType !== "birthday");
    if (candidates.length === 0) return null;

    const kw = (targetTitle || "").toLowerCase().replace(/^✅\s*/, "").trim();
    if (!kw) return candidates[0];

    const exact = candidates.find((ev) =>
      (ev.summary || "").toLowerCase().replace(/^✅\s*/, "").includes(kw)
    );
    if (exact) return exact;

    const words = kw.split(/\s+/).filter((w) => w.length > 1);
    return (
      candidates.find((ev) => {
        const s = (ev.summary || "").toLowerCase();
        return words.some((w) => s.includes(w));
      }) || null
    );
  }

  async function executeAiAction(schedule) {
    if (!schedule || typeof schedule !== "object") return { ok: false, message: "Dữ liệu lịch không hợp lệ." };
    const action = (schedule.action || "create").toLowerCase();

    if (action === "create") {
      const ok = await createEvent(schedule);
      return { ok, message: ok ? "Đã thêm vào Google Calendar" : "Không thể thêm lịch" };
    }

    const matched = await findMatchingEvent(schedule.targetTitle || schedule.title, schedule.targetDate || schedule.date);
    if (!matched) {
      notify("Không tìm thấy sự kiện phù hợp trong ngày để thực hiện thao tác.");
      return { ok: false, message: "Không tìm thấy sự kiện khớp tên" };
    }

    if (action === "delete") {
      if (!accessToken) await refreshSession({ reload: false });
      if (!accessToken) return { ok: false, message: "Chưa đăng nhập Google" };
      const endpoint = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(matched.id)}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.status === 204 || res.ok) {
        delete checklistState[matched.id];
        delete eventDoneState[matched.id];
        saveChecklist();
        saveDoneState();
        notify(`Đã xóa "${matched.summary}" khỏi Google Calendar.`);
        await loadEvents({ skipRefresh: true });
        return { ok: true, message: "Đã xóa khỏi Google Calendar" };
      }
      return { ok: false, message: "Lỗi khi xóa sự kiện" };
    }

    if (action === "complete") {
      const targetDone = typeof schedule.done === "boolean" ? schedule.done : true;
      await toggleEventDone(matched.id, targetDone);
      return {
        ok: true,
        message: targetDone ? "Đã đánh dấu hoàn thành" : "Đã mở lại công việc"
      };
    }

    if (action === "update") {
      const oldStart = new Date(matched.start.dateTime);
      const oldEnd = new Date(matched.end.dateTime);
      const newDate = schedule.date || toInputDate(oldStart);
      const newStart = schedule.startTime || toInputTime(oldStart);
      const newEnd = schedule.endTime || toInputTime(oldEnd);
      const cleanOldTitle = (matched.summary || "").replace(/^✅\s*/, "");
      const newTitle = schedule.title || cleanOldTitle;

      const ok = await updateEvent(matched.id, {
        title: newTitle,
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
        description: schedule.description !== undefined ? schedule.description : matched.description || ""
      });
      return { ok, message: ok ? "Đã cập nhật trên Google Calendar" : "Lỗi cập nhật lịch" };
    }

    return { ok: false, message: "Hành động không hỗ trợ" };
  }

  function bindSectionEvents() {
    syncUI();
    if (accessToken) loadEvents({ skipRefresh: true });
    refreshSession({ reload: true });
  }

  handleRedirectParams();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      syncUI();
      refreshSession({ reload: false });
    });
  } else {
    syncUI();
    refreshSession({ reload: false });
  }

  return {
    GOOGLE_CLIENT_ID,
    SCOPES,
    login,
    logout,
    loadEvents,
    createEvent,
    updateEvent,
    toggleEventDone,
    deleteEvent,
    executeAiAction,
    bindSectionEvents
  };
})();
