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
    const mount = document.getElementById("sectionMount") || document;
    const form =
      mount.querySelector("#chatForm, #aiChatForm, form.chat-form, form.ai-form") ||
      mount.querySelector("form");
    const input =
      mount.querySelector("#chatInput, #aiInput, .chat-input, input[type='text'], textarea") ||
      (form ? form.querySelector("input, textarea") : null);
    const sendBtn =
      mount.querySelector("#chatSendBtn, #sendChatBtn, button[type='submit']") ||
      (form ? form.querySelector("button") : null);
    const messagesBox = mount.querySelector(
      "#chatMessages, #aiMessages, .chat-messages, .ai-messages, .chat-body"
    );
    return { form, input, sendBtn, messagesBox };
  }

  async function syncScheduleToCalendar(schedule) {
    if (window.GoogleCalendarManager && typeof window.GoogleCalendarManager.createEvent === "function") {
      return await window.GoogleCalendarManager.createEvent(schedule);
    }
    return false;
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

    const hasSchedule = Boolean(schedule && schedule.title && schedule.date);
    if (hasSchedule) {
      const displayDate = formatIsoToDmy(schedule.date);
      const timeRange = `${schedule.startTime || "08:00"} - ${schedule.endTime || "09:00"}`;
      html += `
        <div class="schedule-draft">
          <div>
            <strong>📅 ${escapeHtml(schedule.title)}</strong>
            <div class="draft-details">🗓 ${escapeHtml(displayDate)} • ⏰ ${escapeHtml(timeRange)}</div>
          </div>
          <div class="draft-actions">
            <button type="button" class="btn btn-primary btn-sm save-gcal-btn" disabled>Đang lưu tự động...</button>
          </div>
        </div>
      `;
    }

    row.innerHTML = html;
    messagesBox.appendChild(row);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    if (hasSchedule) {
      const saveBtn = row.querySelector(".save-gcal-btn");
      const saved = await syncScheduleToCalendar(schedule);
      if (saveBtn) {
        if (saved) {
          saveBtn.textContent = "✓ Đã lưu vào Google Calendar";
          saveBtn.disabled = true;
        } else {
          saveBtn.textContent = "+ Lưu vào Google Calendar";
          saveBtn.disabled = false;
          saveBtn.addEventListener("click", async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = "Đang lưu...";
            const ok = await syncScheduleToCalendar(schedule);
            if (ok) {
              saveBtn.textContent = "✓ Đã lưu vào Google Calendar";
            } else {
              saveBtn.disabled = false;
              saveBtn.textContent = "+ Lưu vào Google Calendar";
            }
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
      const mount = document.getElementById("sectionMount");
      if (mount && mount.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        handleSendMessage(e);
      }
    },
    true
  );

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const { sendBtn } = getChatElements();
    if (sendBtn && btn === sendBtn) {
      e.preventDefault();
      handleSendMessage(e);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const { input } = getChatElements();
      if (input && document.activeElement === input) {
        e.preventDefault();
        handleSendMessage(e);
      }
    }
  });
})();
