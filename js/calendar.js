window.GoogleCalendarManager = (function () {
  // [BẠN CẦN ĐIỀN]:
  // Tạo OAuth 2.0 Client ID (Web application) trên Google Cloud Console (bật Google Calendar API),
  // khai báo Authorized JavaScript origins là https://dinhhuuphuc.com và https://www.dinhhuuphuc.com,
  // sau đó dán Client ID của bạn vào chuỗi dưới đây:
  const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";
  const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

  let tokenClient = null;
  let accessToken = sessionStorage.getItem("dhp_gcal_token") || "";
  let userEmail = sessionStorage.getItem("dhp_gcal_email") || "";

  function ensureClient() {
    if (tokenClient) return true;
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      window.showToast("Thư viện đăng nhập Google đang tải, bạn thử bấm lại sau 1 giây nhé!");
      return false;
    }
    if (GOOGLE_CLIENT_ID.startsWith("YOUR_GOOGLE_OAUTH_CLIENT_ID")) {
      window.showToast("Bạn chưa điền GOOGLE_CLIENT_ID trong file js/calendar.js!");
      return false;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) {
          window.showToast("Đăng nhập Google không thành công.");
          return;
        }
        accessToken = response.access_token;
        sessionStorage.setItem("dhp_gcal_token", accessToken);
        await fetchUserProfile();
        syncUI();
        await loadEvents();
        window.showToast("Đã kết nối Google Calendar!");
      }
    });
    return true;
  }

  async function fetchUserProfile() {
    if (!accessToken) return;
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        userEmail = data.email || "Tài khoản Google";
        sessionStorage.setItem("dhp_gcal_email", userEmail);
      }
    } catch {
      userEmail = "Tài khoản Google";
    }
  }

  function login() {
    if (!ensureClient()) return;
    tokenClient.requestAccessToken({ prompt: "consent" });
  }

  function logout() {
    if (accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = "";
    userEmail = "";
    sessionStorage.removeItem("dhp_gcal_token");
    sessionStorage.removeItem("dhp_gcal_email");
    syncUI();
    window.showToast("Đã đăng xuất Google Calendar.");
  }

  function syncUI() {
    const headerArea = document.getElementById("headerAuthArea");
    const cardControls = document.getElementById("calendarAuthControls");
    const userBar = document.getElementById("calendarUserBar");
    const emailLabel = document.getElementById("loggedUserEmail");
    const container = document.getElementById("calendarEventsContainer");

    if (accessToken) {
      if (headerArea) {
        headerArea.innerHTML = `<span class="status-pill">${userEmail || "Đã đăng nhập"}</span>`;
      }
      if (cardControls) cardControls.classList.add("hidden");
      if (userBar) userBar.classList.remove("hidden");
      if (emailLabel) emailLabel.textContent = userEmail;
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

  async function loadEvents() {
    const container = document.getElementById("calendarEventsContainer");
    if (!accessToken || !container) return;

    container.innerHTML = `<div class="calendar-empty-state">Đang tải lịch làm việc từ Google Calendar...</div>`;

    try {
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);

      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin.toISOString());
      url.searchParams.set("maxResults", "12");
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (res.status === 401) {
        logout();
        window.showToast("Phiên đăng nhập Google đã hết hạn, vui lòng đăng nhập lại.");
        return;
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
      window.showToast("Bạn cần đăng nhập Google trước khi lưu sự kiện lên Google Calendar!");
      login();
      return false;
    }

    const startDateTime = `${schedule.date}T${schedule.startTime}:00+07:00`;
    const endDateTime = `${schedule.date}T${schedule.endTime}:00+07:00`;

    try {
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
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

      if (!res.ok) {
        window.showToast("Không thể lưu lên Google Calendar. Kiểm tra lại quyền Calendar API.");
        return false;
      }

      window.showToast("Đã thêm lịch làm việc vào Google Calendar!");
      await loadEvents();
      return true;
    } catch {
      window.showToast("Lỗi mạng khi lưu sự kiện lên Google Calendar.");
      return false;
    }
  }

  function bindSectionEvents() {
    document.getElementById("googleLoginHeaderBtn")?.addEventListener("click", login);
    document.getElementById("googleLoginCardBtn")?.addEventListener("click", login);
    document.getElementById("googleLogoutBtn")?.addEventListener("click", logout);
    document.getElementById("refreshCalendarBtn")?.addEventListener("click", loadEvents);
    syncUI();
    if (accessToken) {
      loadEvents();
    }
  }

  return {
    login,
    logout,
    loadEvents,
    createEvent,
    bindSectionEvents
  };
})();
