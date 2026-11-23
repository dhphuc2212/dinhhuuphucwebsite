window.GoogleCalendarManager = (function () {
  const GOOGLE_CLIENT_ID = "645926964017-6hqgk9jf1umh6qu1tc6vu0ec5c233pta.apps.googleusercontent.com";
  const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

  let accessToken = sessionStorage.getItem("dhp_gcal_token") || "";
  let userEmail = sessionStorage.getItem("dhp_gcal_email") || "";
  let expiresAtMs = Number(sessionStorage.getItem("dhp_gcal_exp") || "0") || 0;
  let refreshTimer = null;
  let ongoingRefreshPromise = null;

  function notify(msg) {
    if (typeof window.showToast === "function") {
      window.showToast(msg);
    }
  }

  function escapeHtml(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getRemember60() {
    const cb = document.getElementById("remember60DaysCheckbox");
    return cb ? Boolean(cb.checked) : true;
  }

  function persistCache() {
    try {
      if (accessToken) {
        sessionStorage.setItem("dhp_gcal_token", accessToken);
      } else {
        sessionStorage.removeItem("dhp_gcal_token");
      }
      if (userEmail) {
        sessionStorage.setItem("dhp_gcal_email", userEmail);
      } else {
        sessionStorage.removeItem("dhp_gcal_email");
      }
      if (expiresAtMs) {
        sessionStorage.setItem("dhp_gcal_exp", String(expiresAtMs));
      } else {
        sessionStorage.removeItem("dhp_gcal_exp");
      }
    } catch {}
  }

  function scheduleAutoRefresh(expiresInSec = 3500) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    const delayMs = Math.max(15000, (Number(expiresInSec) - 120) * 1000);
    refreshTimer = setTimeout(() => {
      refreshSession({ silent: true, reload: false });
    }, delayMs);
  }

  async function refreshSession({ silent = true, reload = false } = {}) {
    if (ongoingRefreshPromise) {
      return ongoingRefreshPromise;
    }

    ongoingRefreshPromise = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { credentials: "include" });
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
      } catch {}

      if (!silent) {
        accessToken = "";
        userEmail = "";
        expiresAtMs = 0;
        persistCache();
        syncUI();
      }
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
    const authUrl = `/api/auth/google/start?remember60=${remember60}`;
    const popup = window.open(authUrl, "dhp_google_auth", "width=520,height=650");

    const onMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "DHP_GCAL_AUTH_SUCCESS") {
        window.removeEventListener("message", onMessage);
        accessToken = event.data.accessToken || "";
        userEmail = event.data.email || "Tài khoản Google";
        expiresAtMs = Number(event.data.expiresAtMs) || 0;
        persistCache();
        syncUI();
        scheduleAutoRefresh(event.data.expiresIn || 3600);
        await loadEvents({ skipRefresh: true });
        notify(
          event.data.remember60
            ? "Đã kết nối Google Calendar (duy trì 60 ngày)!"
            : "Đã kết nối Google Calendar!"
        );
      } else if (event.data?.type === "DHP_GCAL_AUTH_ERROR") {
        window.removeEventListener("message", onMessage);
        notify("Đăng nhập Google không thành công.");
      }
    };

    window.addEventListener("message", onMessage);

    if (!popup) {
      window.location.href = authUrl;
    }
  }

  async function logout() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (accessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(accessToken, () => {});
      } catch {}
    }

    accessToken = "";
    userEmail = "";
    expiresAtMs = 0;
    persistCache();
    syncUI();

    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}

    notify("Đã đăng xuất Google Calendar.");
  }

  function syncUI() {
    const headerArea = document.getElementById("headerAuthArea");
    const cardControls = document.getElementById("calendarAuthControls");
    const userBar = document.getElementById("calendarUserBar");
    const emailLabel = document.getElementById("loggedUserEmail");
    const container = document.getElementById("calendarEventsContainer");

    if (accessToken) {
      if (headerArea) {
        headerArea.innerHTML = `
          <span class="status-pill">${escapeHtml(userEmail || "Đã đăng nhập")}</span>
          <button type="button" id="headerLogoutBtn" class="btn btn-outline btn-sm">
            Đăng xuất
          </button>`;
        document.getElementById("headerLogoutBtn")?.addEventListener("click", logout);
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
        document.getElementById("googleLoginHeaderBtn")?.addEventListener("click", login);
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

  async function deleteEvent(eventId, title = "") {
    if (!eventId) return false;
    if (!accessToken) {
      await refreshSession({ silent: true, reload: false });
    }
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
        const refreshedToken = await refreshSession({ silent: false, reload: false });
        if (refreshedToken) {
          res = await fetch(endpoint, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${refreshedToken}` }
          });
        }
      }

      if (res.status === 204 || res.ok) {
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

  async function loadEvents({ skipRefresh = false } = {}) {
    const container = document.getElementById("calendarEventsContainer");
    if (!container) return;

    if (!accessToken && !skipRefresh) {
      await refreshSession({ silent: true, reload: false });
    }
    if (!accessToken) return;

    container.innerHTML = `<div class="calendar-empty-state">Đang tải lịch làm việc từ Google Calendar...</div>`;

    try {
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);

      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin.toISOString());
      url.searchParams.set("maxResults", "15");
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");

      let res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (res.status === 401) {
        const refreshedToken = await refreshSession({ silent: false, reload: false });
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
      const items = data.items || [];

      if (items.length === 0) {
        container.innerHTML = `<div class="calendar-empty-state">Không có lịch làm việc sắp tới trên Google Calendar của bạn. Hãy nhắn cho AI Chatbot ở trên để thêm nhanh nhé!</div>`;
        return;
      }

      container.innerHTML = items
        .map((ev) => {
          const startRaw = ev.start?.dateTime || ev.start?.date || "";
          const formattedTime = startRaw.includes("T")
            ? new Date(startRaw).toLocaleString("vi-VN", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              })
            : startRaw;
          const canDelete = ev.eventType !== "birthday";
          const safeTitle = escapeHtml(ev.summary || "(Không có tiêu đề)");
          const safeId = escapeHtml(ev.id || "");

          return `
            <article class="event-card" style="position:relative;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div class="event-time">${escapeHtml(formattedTime)}</div>
                ${
                  canDelete
                    ? `<button type="button" class="btn btn-outline btn-sm delete-event-btn" data-event-id="${safeId}" data-event-title="${safeTitle}" style="padding:2px 8px;font-size:0.75rem;">Xóa</button>`
                    : ""
                }
              </div>
              <div class="event-title">${safeTitle}</div>
              ${ev.description ? `<div class="event-desc">${escapeHtml(ev.description)}</div>` : ""}
            </article>
          `;
        })
        .join("");

      container.querySelectorAll(".delete-event-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          deleteEvent(btn.dataset.eventId, btn.dataset.eventTitle);
        });
      });
    } catch {
      container.innerHTML = `<div class="calendar-empty-state">Không thể tải sự kiện lúc này. Bạn thử bấm Làm mới lịch nhé.</div>`;
    }
  }

  function normalizeTime(t, fallback) {
    if (!t || typeof t !== "string") return fallback;
    const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return fallback;
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  }

  async function createEvent(schedule) {
    if (!accessToken) {
      await refreshSession({ silent: true, reload: false });
    }
    if (!accessToken) {
      notify("Bạn cần đăng nhập Google trước khi lưu sự kiện lên Google Calendar!");
      login();
      return false;
    }

    const startDate = schedule.date || new Date().toISOString().slice(0, 10);
    const endDate = schedule.endDate || startDate;
    const startTime = normalizeTime(schedule.startTime, "09:00");
    const endTime = normalizeTime(schedule.endTime, "10:00");

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
        const refreshedToken = await refreshSession({ silent: false, reload: false });
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
        notify(`Không thể lưu lên Google Calendar: ${err?.error?.message || res.status}`);
        return false;
      }

      notify("Đã thêm lịch làm việc vào Google Calendar!");
      await loadEvents({ skipRefresh: true });
      return true;
    } catch {
      notify("Lỗi mạng khi lưu sự kiện lên Google Calendar.");
      return false;
    }
  }

  function bindSectionEvents() {
    document.getElementById("googleLoginHeaderBtn")?.addEventListener("click", login);
    document.getElementById("googleLoginCardBtn")?.addEventListener("click", login);
    document.getElementById("googleLogoutBtn")?.addEventListener("click", logout);
    document.getElementById("refreshCalendarBtn")?.addEventListener("click", () => loadEvents());
    syncUI();

    if (accessToken) {
      loadEvents({ skipRefresh: true });
    }
    refreshSession({ silent: true, reload: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      refreshSession({ silent: true, reload: false });
    });
  } else {
    refreshSession({ silent: true, reload: false });
  }

  return {
    GOOGLE_CLIENT_ID,
    SCOPES,
    login,
    logout,
    loadEvents,
    createEvent,
    deleteEvent,
    bindSectionEvents
  };
})();
