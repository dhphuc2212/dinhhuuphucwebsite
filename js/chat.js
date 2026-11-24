(function () {
  function formatIsoToDmy(isoStr = "") {
    const m = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : isoStr;
  }

  function escapeHtml(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getChatElements() {
    const card = document.querySelector(".ai-hub-card") || document;
    const form = card.querySelector("#chatForm, #aiChatForm, form");
    const input = card.querySelector("#chatInput, #aiInput, .chat-input");
    const sendBtn = card.querySelector("#chatSendBtn, #sendChatBtn, .chat-input-bar button");
    const messagesBox = card.querySelector("#chatMessages, #aiMessages, .chat-messages");
    return { form, input, sendBtn, messagesBox };
  }

  async function syncScheduleToCalendar(schedule) {
    const mgr = window.GoogleCalendarManager;
    if (!mgr) return { ok: false, message: "Chưa sẵn sàng" };
    if (typeof mgr.executeAiAction === "function") {
      return await mgr.executeAiAction(schedule);
    }
    if (typeof mgr.createEvent === "function") {
      const ok = await mgr.createEvent(schedule);
      return { ok, message: ok ? "Đã lưu vào Google Calendar" : "Chưa thể lưu" };
    }
    return { ok: false, message: "Chưa sẵn sàng" };
  }

  async function appendMessage(messagesBox, role, text, schedule = null) {
    if (!messagesBox) return;

    const isUser = role === "user";
    const row = document.createElement("div");
    row.className = isUser ? "chat-row user" : "chat-row bot";

    const senderLabel = isUser ? "Bạn" : "Trợ lý AI";
    let html = `
      <span class="chat-sender">${senderLabel}</span>
      <div class="chat-bubble ${isUser ? "user" : "bot"}">${escapeHtml(text)}</div>
    `;

    const hasSchedule = Boolean(schedule && (schedule.title || schedule.targetTitle));
    if (hasSchedule) {
      const displayTitle = schedule.title || schedule.targetTitle || "Lịch làm việc";
      const displayDate = formatIsoToDmy(schedule.date || schedule.targetDate || "");
      const timeRange =
        schedule.startTime && schedule.endTime ? ` • ⏰ ${schedule.startTime} - ${schedule.endTime}` : "";
      html += `
        <div class="schedule-draft">
          <div>
            <strong>📅 ${escapeHtml(displayTitle)}</strong>
            <div class="draft-details">${displayDate ? `🗓 ${escapeHtml(displayDate)}` : ""}${escapeHtml(
              timeRange
            )}</div>
          </div>
          <div class="draft-actions">
            <button type="button" class="btn btn-primary btn-sm save-gcal-btn" disabled>Đang đồng bộ...</button>
          </div>
        </div>
      `;
    }

    row.innerHTML = html;
    messagesBox.appendChild(row);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    if (hasSchedule) {
      const saveBtn = row.querySelector(".save-gcal-btn");
      const result = await syncScheduleToCalendar(schedule);
      if (saveBtn) {
        if (result.ok) {
          saveBtn.textContent = `✓ ${result.message}`;
          saveBtn.disabled = true;
        } else {
          saveBtn.textContent = result.message || "+ Thử đồng bộ lại";
          saveBtn.disabled = false;
          saveBtn.addEventListener("click", async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = "Đang xử lý...";
            const retry = await syncScheduleToCalendar(schedule);
            saveBtn.textContent = retry.ok ? `✓ ${retry.message}` : retry.message;
            saveBtn.disabled = retry.ok;
          });
        }
      }
    }
  }

  let isSending = false;

  async function handleSendMessage(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSending) return;

    const { input, sendBtn, messagesBox } = getChatElements();
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    isSending = true;
    input.value = "";
    const oldBtnHtml = sendBtn ? sendBtn.innerHTML : "";
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Đang...";
    }

    await appendMessage(messagesBox, "user", message);

    try {
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          today: todayIso,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh"
        })
      });

      const data = await res.json();
      await appendMessage(
        messagesBox,
        "bot",
        data.reply || "Xin lỗi, trợ lý AI chưa thể phản hồi lúc này.",
        data.schedule || null
      );
    } catch {
      await appendMessage(messagesBox, "bot", "Không thể kết nối tới máy chủ AI. Bạn thử lại nhé!");
    } finally {
      isSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = oldBtnHtml || "Gửi →";
      }
      input.focus();
    }
  }

  document.addEventListener(
    "submit",
    (e) => {
      if (e.target.closest(".ai-hub-card")) {
        e.preventDefault();
        e.stopPropagation();
        handleSendMessage(e);
      }
    },
    true
  );

  document.addEventListener("click", (e) => {
    const sendBtn = e.target.closest("#chatSendBtn, #sendChatBtn, .chat-input-bar button");
    if (sendBtn) {
      e.preventDefault();
      handleSendMessage(e);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const input = e.target.closest("#chatInput, #aiInput, .chat-input");
      if (input) {
        e.preventDefault();
        handleSendMessage(e);
      }
    }
  });
})();
