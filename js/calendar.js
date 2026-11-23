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
        userEmail = event.data.email || "Tài khoản Google";
        expiresAtMs = Number(event.data.expiresAtMs) || 0;
        persistCache();
        await refreshSession({ silent: false, reload: true });
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
          <span class="status-pill">${userEmail || "Đã đăng nhập"}</span>
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
      url.searchParams.set("maxResults", "12");
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

          return `
            <article class="event-card">
              <div class="event-time">${formattedTime}</div>
              <div class="event-title">${ev.summary || "(Không có tiêu đề)"}</div>
              ${ev.description ? `<div class="event-desc">${ev.description}</div>` : ""}
            </article>
          `;
        })
        .join("");
    } catch {
      container.innerHTML = `<div class="calendar-empty-state">Không thể tải sự kiện lúc này. Bạn thử bấm Làm mới lịch nhé.</div>`;
    }
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

    const startDateTime = `${schedule.date}T${schedule.startTime}:00+07:00`;
    const endDateTime = `${schedule.date}T${schedule.endTime}:00+07:00`;

    try {
      let res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          summary: schedule.title,
          description: schedule.description || "Tạo tự động từ Trợ lý AI trên dinhhuuphuc.com",
          start: { dateTime: startDateTime, timeZone: "Asia/Ho_Chi_Minh" },
          end: { dateTime: endDateTime, timeZone: "Asia/Ho_Chi_Minh" }
        })
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
            body: JSON.stringify({
              summary: schedule.title,
              description: schedule.description || "Tạo tự động từ Trợ lý AI trên dinhhuuphuc.com",
              start: { dateTime: startDateTime, timeZone: "Asia/Ho_Chi_Minh" },
              end: { dateTime: endDateTime, timeZone: "Asia/Ho_Chi_Minh" }
            })
          });
        }
      }

      if (!res.ok) {
        notify("Không thể lưu lên Google Calendar. Kiểm tra lại quyền Calendar API.");
        return false;
      }

      notify("Đã thêm lịch làm việc vào Google Calendar!");
      await loadEvents();
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
    bindSectionEvents
  };
})();
