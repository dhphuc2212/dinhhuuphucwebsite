(function () {
  const sectionMount = document.getElementById("sectionMount");
  const scrollProgress = document.getElementById("scrollProgress");
  const trollModal = document.getElementById("trollModal");
  const toastEl = document.getElementById("toastNotice");

  window.showToast = function (message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 3000);
  };

  window.addEventListener("scroll", () => {
    if (!scrollProgress) return;
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    scrollProgress.style.width = `${pct}%`;
  });

  function downloadVCard() {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Đinh;Hữu Phúc;;;",
      "FN:Đinh Hữu Phúc",
      "EMAIL;TYPE=INTERNET:contact@gaoongdu.vn",
      "URL:https://zalo.me/0983533945",
      "ADR;TYPE=HOME:;;Hòa Bình;TP. Hồ Chí Minh;;;Việt Nam",
      "END:VCARD"
    ].join("\r\n");

    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Dinh_Huu_Phuc.vcf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    window.showToast("Đã tải danh bạ Đinh Hữu Phúc (.vcf)!");
  }

  function openTrollModal() {
    trollModal?.classList.remove("hidden");
  }

  function closeTrollModal() {
    trollModal?.classList.add("hidden");
  }

  function startTypewriter() {
    const el = document.getElementById("typewriterText");
    if (!el) return;
    const roles = [
      "Thương mại & Phân phối",
      "Tối ưu Vận hành & Logistics",
      "Kết nối & Công nghệ"
    ];
    let roleIdx = 0;
    let charIdx = roles[0].length;
    let deleting = true;

    clearInterval(window._typewriterTimer);
    window._typewriterTimer = setInterval(() => {
      const target = document.getElementById("typewriterText");
      if (!target) {
        clearInterval(window._typewriterTimer);
        return;
      }
      const current = roles[roleIdx];
      if (deleting) {
        charIdx--;
        target.textContent = current.slice(0, charIdx);
        if (charIdx <= 0) {
          deleting = false;
          roleIdx = (roleIdx + 1) % roles.length;
        }
      } else {
        charIdx++;
        target.textContent = current.slice(0, charIdx);
        if (charIdx >= current.length) {
          deleting = true;
        }
      }
    }, 110);
  }

  async function loadTab(tabName) {
    const validTabs = ["about", "work", "minigame", "brain"];
    const tab = validTabs.includes(tabName) ? tabName : "about";

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    try {
      const res = await fetch(`/sections/${tab}.html`);
      const html = await res.text();
      sectionMount.innerHTML = html;

      sectionMount.querySelectorAll("[data-tab]").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          loadTab(el.dataset.tab);
        });
      });

      if (tab === "about") {
        startTypewriter();
        document.getElementById("downloadVcardBtn")?.addEventListener("click", downloadVCard);
        document.getElementById("trollBtn")?.addEventListener("click", openTrollModal);
        document.getElementById("copyEmailBtn")?.addEventListener("click", () => {
          navigator.clipboard?.writeText("contact@gaoongdu.vn");
          window.showToast("Đã sao chép email: contact@gaoongdu.vn");
        });
        window.initChatAssistant?.();
        window.GoogleCalendarManager?.bindSectionEvents();
      } else if (tab === "work") {
        window.initWorkSection?.();
      } else if (tab === "minigame") {
        initMiniGameSwitcher();
      } else if (tab === "brain") {
        window.SecondBrainManager?.initTab();
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      sectionMount.innerHTML = `<div class="skeleton-loader">Không tải được mục ${tab}. Vui lòng tải lại trang.</div>`;
    }
  }

  function initMiniGameSwitcher() {
    const gameBtns = document.querySelectorAll(".game-tab-btn");
    const panels = {
      caro: document.getElementById("gamePanelCaro"),
      snake: document.getElementById("gamePanelSnake"),
      sudoku: document.getElementById("gamePanelSudoku")
    };

    gameBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.game;
        gameBtns.forEach((b) => b.classList.toggle("active", b === btn));
        Object.entries(panels).forEach(([key, panel]) => {
          panel?.classList.toggle("hidden", key !== target);
        });
      });
    });

    window.initCaroGame?.();
    window.initSnakeGame?.();
    window.initSudokuGame?.();
  }

  document.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      loadTab(el.dataset.tab);
    });
  });

  document.getElementById("footerVcardBtn")?.addEventListener("click", downloadVCard);
  document.getElementById("footerTrollBtn")?.addEventListener("click", openTrollModal);
  document.getElementById("closeTrollBtn")?.addEventListener("click", closeTrollModal);
  trollModal?.addEventListener("click", (e) => {
    if (e.target === trollModal) closeTrollModal();
  });

  loadTab("about");
})();
