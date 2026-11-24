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
      mount.querySelector("#chatInput, #aiInput, input[type='text'], textarea") ||
      (form ? form.querySelector("input, textarea") : null);
    const sendBtn =
      mount.querySelector("#chatSendBtn, #sendChatBtn, button[type='submit']") ||
      (form ? form.querySelector("button") : null);
    const messagesBox = mount.querySelector(
      "#chatMessages, #aiMessages, .chat-messages, .ai-messages, .chat-body"
    );
    return { form, input, sendBtn, messagesBox };
  }

  function appendMessage(messagesBox, role, text, schedule = null) {
    if (!messagesBox) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = role === "user" ? "chat-msg user-msg" : "chat-msg ai-msg";

    let html = `<div class="msg-bubble">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;

    if (schedule && schedule.title && schedule.date) {
      const displayDate = formatIsoToDmy(schedule.date);
      const timeRange = `${schedule.startTime || "08:00"} - ${schedule.endTime || "09:00"}`;
      html += `
        <div class="schedule-preview-card" style="margin-top:8px;padding:10px 12px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;font-size:0.9rem;">
          <div style="font-weight:700;margin-bottom:4px;">📅 Lịch nhận diện: ${escapeHtml(schedule.title)}</div>
          <div>🗓 Ngày: <strong>${escapeHtml(displayDate)}</strong> • ⏰ <strong>${escapeHtml(timeRange)}</strong></div>
          <button type="button" class="btn btn-primary btn-sm save-gcal-btn" style="margin-top:8px;">
            + Lưu vào Google Calendar
          </button>
        </div>
      `;
    }

    msgDiv.innerHTML = html;
    messagesBox.appendChild(msgDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    if (schedule) {
      const saveBtn = msgDiv.querySelector(".save-gcal-btn");
      if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = "Đang lưu...";
          try {
            if (typeof window.createGoogleCalendarEvent === "function") {
              await window.createGoogleCalendarEvent(schedule);
              saveBtn.textContent = "✓ Đã lưu vào Google Calendar";
            } else if (typeof window.addEventToGoogleCalendar === "function") {
              await window.addEventToGoogleCalendar(schedule);
              saveBtn.textContent = "✓ Đã lưu vào Google Calendar";
            } else {
              window.dispatchEvent(new CustomEvent("dhp:save-schedule", { detail: schedule }));
              saveBtn.textContent = "✓ Đã gửi yêu cầu lưu lịch";
            }
          } catch (err) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Thử lưu lại";
          }
        });
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

    appendMessage(messagesBox, "user", message);

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
      appendMessage(
        messagesBox,
        "ai",
        data.reply || "Xin lỗi, trợ lý AI chưa thể phản hồi lúc này.",
        data.schedule || null
      );
    } catch {
      appendMessage(messagesBox, "ai", "Không thể kết nối tới máy chủ AI. Bạn thử lại nhé!");
    } finally {
      isSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = oldBtnHtml || "Gửi →";
      }
      input.focus();
    }
  }

  // Chặn mọi hành vi submit form gây reload trang trên toàn bộ khu vực giao diện
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

  // Bắt sự kiện click vào nút Gửi dù tab được render động
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const { sendBtn } = getChatElements();
    if (sendBtn && btn === sendBtn) {
      e.preventDefault();
      handleSendMessage(e);
    }
  });

  // Bắt phím Enter trong ô nhập chat
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const { input } = getChatElements();
      if (input && document.activeElement === input) {
        e.preventDefault();
        handleSendMessage(e);
      }
    }
  });

  window.initChatUI = function () {
    const { form, sendBtn } = getChatElements();
    if (form) form.setAttribute("onsubmit", "event.preventDefault(); return false;");
    if (sendBtn) sendBtn.setAttribute("type", "button");
  };
})();
