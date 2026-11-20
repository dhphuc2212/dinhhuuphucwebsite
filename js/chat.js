window.initChatAssistant = function () {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const messagesBox = document.getElementById("chatMessages");
  const draftBox = document.getElementById("scheduleDraftBox");
  const draftDetails = document.getElementById("scheduleDraftDetails");
  const confirmBtn = document.getElementById("confirmSaveCalendarBtn");
  const dismissBtn = document.getElementById("dismissDraftBtn");

  if (!form || !input || !messagesBox) return;

  let pendingSchedule = null;

  function appendBubble(text, role) {
    const div = document.createElement("div");
    div.className = `chat-bubble ${role}`;
    div.textContent = text;
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    return div;
  }

  function showScheduleDraft(schedule) {
    if (!schedule || !draftBox || !draftDetails) return;
    pendingSchedule = schedule;
    draftDetails.textContent = `${schedule.title} — Ngày ${schedule.date} (${schedule.startTime} - ${schedule.endTime})`;
    draftBox.classList.remove("hidden");
  }

  function hideScheduleDraft() {
    pendingSchedule = null;
    draftBox?.classList.add("hidden");
  }

  confirmBtn?.addEventListener("click", async () => {
    if (!pendingSchedule) return;
    const ok = await window.GoogleCalendarManager.createEvent(pendingSchedule);
    if (ok) {
      appendBubble(`✅ Đã lưu "${pendingSchedule.title}" vào Google Calendar của bạn.`, "bot");
      hideScheduleDraft();
    }
  });

  dismissBtn?.addEventListener("click", hideScheduleDraft);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendBubble(text, "user");
    input.value = "";
    const loadingBubble = appendBubble("Đang suy nghĩ...", "bot");

    try {
      const todayLocal = new Date().toLocaleDateString("en-CA");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          today: todayLocal,
          timezone: "Asia/Ho_Chi_Minh"
        })
      });

      const data = await res.json();
      loadingBubble.textContent = data.reply || "Đã nhận thông tin!";

      if (data.schedule && data.schedule.title && data.schedule.date) {
        showScheduleDraft(data.schedule);
      }
    } catch {
      loadingBubble.textContent = "Không kết nối được tới /api/chat. Bạn kiểm tra lại Worker nhé.";
    }
  });
};
