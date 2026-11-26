window.SecondBrainManager = (function () {
  let itemsCache = [];
  let sbHistory = [];
  let isSending = false;

  function notify(msg) {
    if (typeof window.showToast === "function") window.showToast(msg);
  }

  function escapeHtml(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getSid() {
    return localStorage.getItem("dhp_gcal_sid") || "";
  }

  async function fetchBrainList() {
    const sid = getSid();
    const statusEl = document.getElementById("sbAccountStatus");
    if (!sid) {
      itemsCache = [];
      if (statusEl) statusEl.textContent = "Chưa đăng nhập Google (chỉ xem)";
      updateCount();
      return;
    }
    try {
      const res = await fetch("/api/brain", {
        credentials: "include",
        cache: "no-store",
        headers: { "X-Session-Id": sid }
      });
      const data = await res.json();
      itemsCache = Array.isArray(data.items) ? data.items : [];
      if (statusEl) {
        statusEl.textContent = data.authenticated
          ? `☁️ Đồng bộ: ${data.email}`
          : "Chưa đăng nhập Google";
      }
      updateCount();
    } catch {}
  }

  function updateCount() {
    const el = document.getElementById("sbTotalCount");
    if (el) el.textContent = String(itemsCache.length);
  }

  function renderList(keyword = "") {
    const box = document.getElementById("dhpBrainListContainer");
    if (!box) return;

    if (!getSid()) {
      box.innerHTML = `<div class="calendar-empty-state">Hãy nhấn <strong>Đăng nhập Google</strong> ở góc trên để lưu và đồng bộ Bộ Não Thứ 2 của riêng bạn.</div>`;
      return;
    }

    const kw = keyword.toLowerCase().trim();
    const filtered = kw
      ? itemsCache.filter((it) =>
          `${it.title} ${it.preview} ${(it.tags || []).join(" ")}`.toLowerCase().includes(kw)
        )
      : itemsCache;

    if (filtered.length === 0) {
      box.innerHTML = `<div class="calendar-empty-state">Chưa có dữ liệu nào. Bạn hãy nhập nội dung ở khung bên trên hoặc nhắn <strong>"Ghi nhớ: ..."</strong> trong khung chat bên phải.</div>`;
      return;
    }

    box.innerHTML = filtered
      .map((it) => {
        const dateStr = it.createdAt ? new Date(it.createdAt).toLocaleDateString("vi-VN") : "";
        const tagsHtml = (it.tags || [])
          .map((t) => `<span class="dhp-brain-tag">#${escapeHtml(t)}</span>`)
          .join("");
        const linkHtml = it.sourceUrl
          ? `<a href="${escapeHtml(it.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem;color:#0d9488;font-weight:600;display:inline-block;margin-top:4px;">🔗 Xem nguồn gốc</a>`
          : "";

        return `
          <div class="dhp-brain-item">
            <div style="flex:1;min-width:0;">
              <div class="dhp-brain-item-title">${escapeHtml(it.title)} <span style="font-weight:400;font-size:0.76rem;color:#94a3b8;">• ${dateStr}</span></div>
              <div class="dhp-brain-item-preview">${escapeHtml(it.preview || "")}</div>
              ${linkHtml}
              ${tagsHtml ? `<div class="dhp-brain-tags">${tagsHtml}</div>` : ""}
            </div>
            <button type="button" class="btn btn-outline btn-sm dhp-brain-del-btn" data-brain-id="${escapeHtml(it.id)}">Xóa</button>
          </div>
        `;
      })
      .join("");

    box.querySelectorAll(".dhp-brain-del-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.brainId;
        if (!window.confirm("Xóa kiến thức này khỏi Bộ não thứ 2?")) return;
        const res = await fetch(`/api/brain/item/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
          headers: { "X-Session-Id": getSid() }
        });
        const data = await res.json();
        if (data.ok) {
          notify("Đã xóa khỏi Bộ não thứ 2.");
          await fetchBrainList();
          renderList(document.getElementById("dhpBrainSearchInput")?.value || "");
        }
      });
    });
  }

  function appendChatBubble(role, text) {
    const box = document.getElementById("sbChatMessages");
    if (!box) return;
    const isUser = role === "user";
    const row = document.createElement("div");
    row.className = isUser ? "chat-row user" : "chat-row bot";
    row.innerHTML = `
      <span class="chat-sender">${isUser ? "Bạn" : "Second Brain AI"}</span>
      <div class="chat-bubble ${isUser ? "user" : "bot"}">${escapeHtml(text)}</div>
    `;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  async function handleBrainChatSubmit(e) {
    e.preventDefault();
    if (isSending) return;
    const input = document.getElementById("sbChatInput");
    const sendBtn = document.getElementById("sbChatSendBtn");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    isSending = true;
    input.value = "";
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Đang tìm...";
    }

    appendChatBubble("user", message);
    const recent = sbHistory.slice(-8);
    sbHistory.push({ role: "user", text: message });

    try {
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const sid = getSid();
      const headers = { "Content-Type": "application/json" };
      if (sid) headers["X-Session-Id"] = sid;

      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          message,
          today: todayIso,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
          history: recent,
          mode: "second_brain"
        })
      });
      const data = await res.json();
      const reply = data.reply || "Tôi chưa tìm thấy thông tin phù hợp trong Bộ não thứ 2.";
      sbHistory.push({ role: "bot", text: reply });
      appendChatBubble("bot", reply);

      if (data.savedMemory) {
        notify(`Đã học: ${data.savedMemory.title}`);
        await fetchBrainList();
        renderList(document.getElementById("dhpBrainSearchInput")?.value || "");
      }
    } catch {
      appendChatBubble("bot", "Lỗi kết nối máy chủ AI. Bạn thử lại nhé!");
    } finally {
      isSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Hỏi AI →";
      }
      input.focus();
    }
  }

  async function initTab() {
    await fetchBrainList();
    renderList("");

    document.getElementById("dhpBrainSearchInput")?.addEventListener("input", (e) => {
      renderList(e.target.value);
    });

    document.getElementById("dhpBrainSaveManualBtn")?.addEventListener("click", async () => {
      const sid = getSid();
      if (!sid) {
        notify("Vui lòng đăng nhập Google trước để lưu kiến thức.");
        return;
      }
      const title = document.getElementById("dhpBrainNewTitle").value.trim();
      const sourceUrl = document.getElementById("dhpBrainNewUrl").value.trim();
      const summary = document.getElementById("dhpBrainNewContent").value.trim();
      const tags = document
        .getElementById("dhpBrainNewTags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (!summary && !sourceUrl) {
        notify("Vui lòng nhập nội dung hoặc đường dẫn cần lưu.");
        return;
      }

      const btn = document.getElementById("dhpBrainSaveManualBtn");
      btn.disabled = true;
      btn.textContent = "Đang lưu...";

      try {
        const res = await fetch("/api/brain", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "X-Session-Id": sid },
          body: JSON.stringify({ title, sourceUrl, summary, tags })
        });
        const data = await res.json();
        if (data.ok) {
          document.getElementById("dhpBrainNewTitle").value = "";
          document.getElementById("dhpBrainNewUrl").value = "";
          document.getElementById("dhpBrainNewContent").value = "";
          document.getElementById("dhpBrainNewTags").value = "";
          notify("Đã nạp kiến thức vào Bộ não thứ 2!");
          await fetchBrainList();
          renderList("");
        } else {
          notify(data.error || "Không thể lưu.");
        }
      } finally {
        btn.disabled = false;
        btn.textContent = "+ Lưu kiến thức";
      }
    });

    document.getElementById("sbChatForm")?.addEventListener("submit", handleBrainChatSubmit);
    document.getElementById("sbClearChatBtn")?.addEventListener("click", () => {
      sbHistory = [];
      const box = document.getElementById("sbChatMessages");
      if (box) {
        box.innerHTML = `
          <div class="chat-row bot">
            <span class="chat-sender">Second Brain AI</span>
            <div class="chat-bubble bot">Đã làm mới phiên hỏi-đáp. Bạn muốn tra cứu kiến thức nào trong kho đã lưu?</div>
          </div>
        `;
      }
    });
  }

  return { initTab, fetchBrainList };
})();
