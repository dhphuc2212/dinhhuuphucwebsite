window.SecondBrainManager = (function () {
  let itemsCache = [];

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
    if (!sid) {
      itemsCache = [];
      updateTriggerCount(0);
      return { authenticated: false, items: [] };
    }
    try {
      const res = await fetch("/api/brain", {
        credentials: "include",
        cache: "no-store",
        headers: { "X-Session-Id": sid }
      });
      const data = await res.json();
      itemsCache = Array.isArray(data.items) ? data.items : [];
      updateTriggerCount(itemsCache.length);
      return data;
    } catch {
      return { authenticated: false, items: [] };
    }
  }

  function updateTriggerCount(count) {
    const btn = document.getElementById("dhpOpenBrainBtn");
    if (btn) {
      btn.textContent = `🧠 Bộ não thứ 2 (${count})`;
    }
  }

  function ensureModal() {
    if (document.getElementById("dhpBrainModal")) return;

    const modal = document.createElement("div");
    modal.id = "dhpBrainModal";
    modal.className = "dhp-brain-modal hidden";
    modal.innerHTML = `
      <div class="dhp-brain-dialog">
        <div class="dhp-brain-head">
          <div>
            <h3>🧠 Bộ Não Thứ 2 — Kho tri thức cá nhân</h3>
            <div style="font-size:0.8rem;color:#64748b;margin-top:2px;">Lưu bài viết, video YouTube/Facebook và kiến thức riêng để AI ghi nhớ & trả lời lại sau này.</div>
          </div>
          <button type="button" id="dhpCloseBrainBtn" class="btn btn-outline btn-sm">Đóng ✕</button>
        </div>
        <div class="dhp-brain-body">
          <div class="dhp-brain-add-box">
            <div style="font-weight:700;font-size:0.86rem;">+ Nạp kiến thức mới trực tiếp</div>
            <input type="text" id="dhpBrainNewTitle" class="dhp-brain-input" placeholder="Tiêu đề ngắn gọn (VD: Ý tưởng video TikTok Gạo Ông Du)" />
            <input type="url" id="dhpBrainNewUrl" class="dhp-brain-input" placeholder="Link YouTube / Facebook / Bài viết (tùy chọn)" />
            <textarea id="dhpBrainNewContent" class="dhp-brain-textarea" placeholder="Dán nội dung bài viết, tóm tắt video hoặc ghi chú muốn AI ghi nhớ..."></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <input type="text" id="dhpBrainNewTags" class="dhp-brain-input" style="max-width:340px;" placeholder="Từ khóa cách nhau dấu phẩy (VD: marketing, video, gạo)" />
              <button type="button" id="dhpBrainSaveManualBtn" class="btn btn-primary btn-sm">Lưu vào Bộ não</button>
            </div>
          </div>

          <input type="search" id="dhpBrainSearchInput" class="dhp-brain-input" placeholder="🔍 Tìm kiếm trong các kiến thức đã lưu..." />
          <div id="dhpBrainListContainer" class="dhp-brain-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("dhpCloseBrainBtn").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.getElementById("dhpBrainSearchInput").addEventListener("input", (e) => {
      renderList(e.target.value);
    });

    document.getElementById("dhpBrainSaveManualBtn").addEventListener("click", async () => {
      const sid = getSid();
      if (!sid) {
        notify("Vui lòng đăng nhập Google trước để lưu vào Bộ não thứ 2.");
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
        btn.textContent = "Lưu vào Bộ não";
      }
    });
  }

  function renderList(keyword = "") {
    const box = document.getElementById("dhpBrainListContainer");
    if (!box) return;

    if (!getSid()) {
      box.innerHTML = `<div class="calendar-empty-state">Bạn chưa đăng nhập Google. Hãy đăng nhập Google ở góc trên để đồng bộ Bộ não thứ 2 của riêng bạn.</div>`;
      return;
    }

    const kw = keyword.toLowerCase().trim();
    const filtered = kw
      ? itemsCache.filter((it) =>
          `${it.title} ${it.preview} ${(it.tags || []).join(" ")}`.toLowerCase().includes(kw)
        )
      : itemsCache;

    if (filtered.length === 0) {
      box.innerHTML = `<div class="calendar-empty-state">Chưa có kiến thức nào khớp từ khóa. Bạn có thể dán bài viết ở trên hoặc nhắn thẳng trong khung chat: <strong>"Ghi nhớ giúp tôi: ..."</strong></div>`;
      return;
    }

    box.innerHTML = filtered
      .map((it) => {
        const dateStr = it.createdAt ? new Date(it.createdAt).toLocaleDateString("vi-VN") : "";
        const tagsHtml = (it.tags || [])
          .map((t) => `<span class="dhp-brain-tag">#${escapeHtml(t)}</span>`)
          .join("");
        const linkHtml = it.sourceUrl
          ? `<a href="${escapeHtml(it.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem;color:#0d9488;font-weight:600;display:inline-block;margin-top:4px;">🔗 Mở nguồn gốc</a>`
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
        if (!window.confirm("Xóa ghi nhớ này khỏi Bộ não thứ 2?")) return;
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

  async function openModal() {
    ensureModal();
    document.getElementById("dhpBrainModal").classList.remove("hidden");
    document.getElementById("dhpBrainListContainer").innerHTML = `<div class="calendar-empty-state">Đang tải kho kiến thức...</div>`;
    await fetchBrainList();
    renderList("");
  }

  function closeModal() {
    const modal = document.getElementById("dhpBrainModal");
    if (modal) modal.classList.add("hidden");
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#dhpOpenBrainBtn")) {
      e.preventDefault();
      openModal();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => fetchBrainList());
  } else {
    fetchBrainList();
  }

  return { openModal, closeModal, fetchBrainList };
})();
