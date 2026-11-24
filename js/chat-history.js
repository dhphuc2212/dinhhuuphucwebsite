window.ChatHistoryManager = (function () {
  const LOCAL_KEY = "dhp_guest_chat_threads_v1";
  let threads = [];
  let activeThreadId = "";
  let isCloudMode = false;
  let cloudEmail = "";
  let syncTimer = null;
  let onRenderCallback = null;

  function makeId() {
    return "chat_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  }

  function createEmptyThread() {
    return {
      id: makeId(),
      title: "Cuộc trò chuyện mới",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          role: "bot",
          text: "Tôi là trợ lý AI. Bạn có thể hỏi thông tin hoặc nhắn trực tiếp để thêm, sửa, xóa và hoàn thành lịch làm việc trên Google Calendar.",
          schedule: null,
          ts: new Date().toISOString()
        }
      ]
    };
  }

  function loadLocalThreads() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createEmptyThread()];
    } catch {
      return [createEmptyThread()];
    }
  }

  function saveLocalThreads() {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(threads.slice(0, 30)));
    } catch {}
  }

  async function pushToCloud() {
    const sid = localStorage.getItem("dhp_gcal_sid") || "";
    if (!sid) return;
    try {
      await fetch("/api/chat/history", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sid
        },
        body: JSON.stringify({ threads })
      });
    } catch {}
  }

  function schedulePersist() {
    if (isCloudMode) {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(pushToCloud, 500);
    } else {
      saveLocalThreads();
    }
  }

  async function init(renderFn) {
    if (typeof renderFn === "function") onRenderCallback = renderFn;

    const sid = localStorage.getItem("dhp_gcal_sid") || "";
    if (sid) {
      try {
        const res = await fetch("/api/chat/history", {
          credentials: "include",
          cache: "no-store",
          headers: { "X-Session-Id": sid }
        });
        const data = await res.json();
        if (data.authenticated) {
          isCloudMode = true;
          cloudEmail = data.email || "";
          threads = Array.isArray(data.threads) && data.threads.length > 0 ? data.threads : [createEmptyThread()];
          if (!threads.some((t) => t.id === activeThreadId)) {
            activeThreadId = threads[0].id;
          }
          if (onRenderCallback) onRenderCallback();
          return;
        }
      } catch {}
    }

    isCloudMode = false;
    cloudEmail = "";
    threads = loadLocalThreads();
    if (!threads.some((t) => t.id === activeThreadId)) {
      activeThreadId = threads[0].id;
    }
    if (onRenderCallback) onRenderCallback();
  }

  function getActiveThread() {
    let found = threads.find((t) => t.id === activeThreadId);
    if (!found) {
      if (threads.length === 0) threads.push(createEmptyThread());
      found = threads[0];
      activeThreadId = found.id;
    }
    return found;
  }

  function appendMessageToActive(role, text, schedule = null) {
    const thread = getActiveThread();
    thread.messages.push({
      role,
      text,
      schedule: schedule || null,
      ts: new Date().toISOString()
    });
    thread.updatedAt = new Date().toISOString();

    if (role === "user" && (thread.title === "Cuộc trò chuyện mới" || thread.messages.filter((m) => m.role === "user").length === 1)) {
      thread.title = text.slice(0, 46) + (text.length > 46 ? "..." : "");
    }

    // Đưa cuộc trò chuyện vừa nhắn lên đầu danh sách
    threads = [thread, ...threads.filter((t) => t.id !== thread.id)];
    schedulePersist();
  }

  function startNewThread() {
    const fresh = createEmptyThread();
    threads = [fresh, ...threads];
    activeThreadId = fresh.id;
    schedulePersist();
    if (onRenderCallback) onRenderCallback();
  }

  function switchThread(threadId) {
    if (threads.some((t) => t.id === threadId)) {
      activeThreadId = threadId;
      if (onRenderCallback) onRenderCallback();
    }
  }

  function deleteActiveThread() {
    threads = threads.filter((t) => t.id !== activeThreadId);
    if (threads.length === 0) threads.push(createEmptyThread());
    activeThreadId = threads[0].id;
    schedulePersist();
    if (onRenderCallback) onRenderCallback();
  }

  function getState() {
    return {
      threads,
      activeThread: getActiveThread(),
      isCloudMode,
      cloudEmail
    };
  }

  return {
    init,
    getState,
    getActiveThread,
    appendMessageToActive,
    startNewThread,
    switchThread,
    deleteActiveThread
  };
})();
