const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api";
const STATS_CACHE_KEY = "desa_motabang_stats_cache";
const THEME_KEY = "desa_motabang_theme";
const STATS_TIMEOUT = 10000;

document.addEventListener("DOMContentLoaded", function () {
  initTheme();
  initYear();
  initNavigation();
  initScrollProgress();
  initBackToTop();
  initRevealAnimations();
  initSmoothScroll();
  initMobileNav();
  initScrollHint();
  initHeroPointLinks();
  initProfileTabs();
  initDusunMap();
  initServiceFilter();
  initServiceAccordion();
  initOpenStatus();
  initCopyPhone();
  loadStatistik();
});

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------------- Theme (gelap / terang) ---------------- */
function initTheme() {
  const toggle = document.getElementById("themeToggle");
  const root = document.documentElement;

  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch (error) {
    saved = null;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (prefersDark ? "dark" : "light");

  applyTheme(initial);

  if (!toggle) return;

  toggle.addEventListener("click", function () {
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      /* abaikan jika storage tidak tersedia */
    }
  });

  function applyTheme(mode) {
    if (mode === "dark") {
      root.setAttribute("data-theme", "dark");
      toggle.setAttribute("aria-pressed", "true");
    } else {
      root.removeAttribute("data-theme");
      toggle.setAttribute("aria-pressed", "false");
    }
  }
}

function initYear() {
  const yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

/* ---------------- Mobile nav ---------------- */
function initMobileNav() {
  const navToggle = document.getElementById("navToggle");
  const mainNavMenu = document.getElementById("mainNavMenu");

  if (!navToggle || !mainNavMenu) return;

  navToggle.addEventListener("click", function () {
    const isOpen = mainNavMenu.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    navToggle.setAttribute("aria-label", isOpen ? "Tutup menu navigasi" : "Buka menu navigasi");
  });

  mainNavMenu.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", function () {
      mainNavMenu.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Buka menu navigasi");
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      mainNavMenu.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Buka menu navigasi");
    }
  });
}

/* ---------------- Scrollspy navigasi ---------------- */
function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section[id]");

  if (!navLinks.length || !sections.length) return;

  function updateActiveLink() {
    let current = "";
    const headerOffset = window.innerWidth <= 820 ? 120 : 140;
    const scrollPosition = window.scrollY + headerOffset;

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        current = section.getAttribute("id");
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove("active");
      const href = (link.getAttribute("href") || "").replace("#", "");
      if (href === current) {
        link.classList.add("active");
      }
    });
  }

  let ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateActiveLink();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateActiveLink);
  updateActiveLink();
}

/* ---------------- Progress bar baca halaman ---------------- */
function initScrollProgress() {
  const bar = document.getElementById("scrollProgressBar");
  if (!bar) return;

  function update() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          update();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );
  window.addEventListener("resize", update);
  update();
}

/* ---------------- Smooth scroll ---------------- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      const offset = window.innerWidth <= 820 ? 110 : 130;
      const offsetTop = target.offsetTop - offset;

      window.scrollTo({
        top: Math.max(offsetTop, 0),
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  });
}

function scrollToSectionId(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const offset = window.innerWidth <= 820 ? 110 : 130;
  const offsetTop = target.offsetTop - offset;
  window.scrollTo({
    top: Math.max(offsetTop, 0),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

function initScrollHint() {
  const hint = document.getElementById("scrollHint");
  if (!hint) return;
  hint.addEventListener("click", function () {
    scrollToSectionId("profil");
  });
}

function initHeroPointLinks() {
  document.querySelectorAll(".hero-point-btn[data-target]").forEach((btn) => {
    btn.addEventListener("click", function () {
      scrollToSectionId(this.getAttribute("data-target"));
    });
  });
}

/* ---------------- Back to top ---------------- */
function initBackToTop() {
  const backToTop = document.getElementById("backToTop");
  if (!backToTop) return;

  function toggleButton() {
    if (window.scrollY > 320) {
      backToTop.classList.add("show");
    } else {
      backToTop.classList.remove("show");
    }
  }

  window.addEventListener("scroll", toggleButton, { passive: true });

  backToTop.addEventListener("click", function () {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  });

  toggleButton();
}

/* ---------------- Reveal animasi saat scroll ---------------- */
function initRevealAnimations() {
  const animateElements = document.querySelectorAll(".reveal-up, .animate-on-scroll");

  if (!animateElements.length) return;

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    animateElements.forEach((el) => {
      el.classList.add("in-view");
      el.classList.add("animated");
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          entry.target.classList.add("animated");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  animateElements.forEach((el) => observer.observe(el));
}

/* ---------------- Tab profil desa ---------------- */
function initProfileTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  if (!tabButtons.length || !tabPanels.length) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const targetId = `tab-${this.getAttribute("data-tab")}`;

      tabButtons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      this.classList.add("active");
      this.setAttribute("aria-selected", "true");

      tabPanels.forEach((panel) => {
        if (panel.id === targetId) {
          panel.hidden = false;
          panel.classList.add("active");
        } else {
          panel.hidden = true;
          panel.classList.remove("active");
        }
      });
    });
  });
}

/* ---------------- Peta dusun interaktif ---------------- */
function initDusunMap() {
  const pins = document.querySelectorAll(".dusun-pin");
  const quickButtons = document.querySelectorAll(".map-quick-btn");
  const titleEl = document.getElementById("mapDetailTitle");
  const textEl = document.getElementById("mapDetailText");

  if (!pins.length || !titleEl || !textEl) return;

  const dusunInfo = {
    1: "Dusun 1 berada di wilayah Desa Motabang dan menjadi bagian dari komunitas warga yang aktif dalam kegiatan pertanian dan kemasyarakatan.",
    2: "Dusun 2 merupakan salah satu wilayah permukiman warga Desa Motabang dengan aktivitas sehari-hari yang didominasi sektor pertanian dan perikanan.",
    3: "Dusun 3 menjadi bagian wilayah Desa Motabang yang turut berkontribusi dalam pembangunan dan kegiatan gotong royong desa.",
    4: "Dusun 4 adalah salah satu dari delapan dusun di Desa Motabang dengan masyarakat yang menjunjung semangat kekeluargaan.",
    5: "Dusun 5 merupakan wilayah Desa Motabang yang turut mendukung potensi pertanian dan perikanan desa.",
    6: "Dusun 6 menjadi bagian dari Desa Motabang dengan warga yang berperan aktif dalam berbagai kegiatan kemasyarakatan.",
    7: "Dusun 7 adalah salah satu wilayah Desa Motabang yang turut menjaga semangat gotong royong antarwarga.",
    8: "Dusun 8 merupakan bagian wilayah Desa Motabang yang melengkapi delapan dusun yang tersebar di seluruh desa.",
  };

  function setActiveDusun(id) {
    pins.forEach((pin) => {
      const isActive = pin.getAttribute("data-id") === String(id);
      pin.classList.toggle("active", isActive);
      pin.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    quickButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-id") === String(id));
    });

    titleEl.textContent = `Dusun ${id}`;
    textEl.textContent =
      dusunInfo[id] ||
      "Informasi lebih lanjut mengenai dusun ini dapat diperoleh langsung di kantor Desa Motabang.";
  }

  pins.forEach((pin) => {
    const id = pin.getAttribute("data-id");

    pin.addEventListener("click", () => setActiveDusun(id));
    pin.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setActiveDusun(id);
      }
    });
  });

  quickButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveDusun(btn.getAttribute("data-id")));
  });
}

/* ---------------- Pencarian layanan ---------------- */
function initServiceFilter() {
  const input = document.getElementById("serviceSearch");
  const cards = document.querySelectorAll(".service-card");
  const countEl = document.getElementById("serviceCount");
  const emptyEl = document.getElementById("serviceEmpty");

  if (!input || !cards.length) return;

  function applyFilter() {
    const query = input.value.trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach((card) => {
      const title = card.querySelector("h3")?.textContent.toLowerCase() || "";
      const desc = card.querySelector("p")?.textContent.toLowerCase() || "";
      const keywords = (card.getAttribute("data-keywords") || "").toLowerCase();
      const haystack = `${title} ${desc} ${keywords}`;
      const match = query === "" || haystack.includes(query);

      card.classList.toggle("is-hidden", !match);
      if (match) visibleCount += 1;
    });

    if (countEl) {
      countEl.textContent = `${visibleCount} layanan tersedia`;
    }

    if (emptyEl) {
      emptyEl.hidden = visibleCount !== 0;
    }
  }

  input.addEventListener("input", applyFilter);
  applyFilter();
}

/* ---------------- Accordion detail layanan ---------------- */
function initServiceAccordion() {
  const triggers = document.querySelectorAll(".service-card-trigger");

  if (!triggers.length) return;

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", function () {
      const card = this.closest(".service-card");
      const isOpen = this.getAttribute("aria-expanded") === "true";

      this.setAttribute("aria-expanded", isOpen ? "false" : "true");
      this.querySelector(".service-toggle").textContent = isOpen ? "+" : "×";

      if (card) {
        card.classList.toggle("is-open", !isOpen);
      }
    });
  });
}

/* ---------------- Status buka/tutup kantor desa ---------------- */
function initOpenStatus() {
  const wrap = document.getElementById("openStatus");
  const textEl = document.getElementById("openStatusText");

  if (!wrap || !textEl) return;

  const now = new Date();
  const day = now.getDay(); // 0 = Minggu, 1-5 = Senin-Jumat, 6 = Sabtu
  const hour = now.getHours();
  const minute = now.getMinutes();
  const minutesNow = hour * 60 + minute;

  let isOpen = false;
  let message = "";

  if (day >= 1 && day <= 5) {
    isOpen = minutesNow >= 8 * 60 && minutesNow < 16 * 60;
    message = isOpen ? "Sedang buka sekarang · 08.00 - 16.00" : "Tutup sekarang · buka kembali 08.00";
  } else if (day === 6) {
    isOpen = minutesNow >= 8 * 60 && minutesNow < 12 * 60;
    message = isOpen ? "Sedang buka sekarang · 08.00 - 12.00" : "Tutup sekarang · jam layanan Sabtu 08.00 - 12.00";
  } else {
    isOpen = false;
    message = "Tutup hari ini · Minggu libur pelayanan";
  }

  wrap.classList.add(isOpen ? "is-open" : "is-closed");
  textEl.textContent = message;
}

/* ---------------- Salin nomor telepon ---------------- */
function initCopyPhone() {
  const btn = document.getElementById("copyPhoneBtn");
  if (!btn) return;

  btn.addEventListener("click", async function () {
    const phone = this.getAttribute("data-phone") || "";

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(phone);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = phone;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      showToast("Nomor telepon disalin");
    } catch (error) {
      showToast("Gagal menyalin nomor");
    }
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

/* ---------------- Statistik kependudukan ---------------- */
async function fetchWithTimeout(url, options = {}, timeout = STATS_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function saveStatsToCache(data) {
  try {
    localStorage.setItem(
      STATS_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (error) {
    console.warn("Cache statistik gagal disimpan:", error);
  }
}

function getStatsFromCache() {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;

    return parsed.data;
  } catch (error) {
    console.warn("Cache statistik tidak valid:", error);
    return null;
  }
}

function updateStatBars(data) {
  const total = Number(data?.total) || 0;
  const laki = Number(data?.laki) || 0;
  const perempuan = Number(data?.perempuan) || 0;
  const keluarga = Number(data?.keluarga) || 0;

  const barTotal = document.getElementById("barTotal");
  const barLaki = document.getElementById("barLaki");
  const barPerempuan = document.getElementById("barPerempuan");
  const barKK = document.getElementById("barKK");

  const maxRef = Math.max(total, 1);

  requestAnimationFrame(() => {
    if (barTotal) barTotal.style.width = "100%";
    if (barLaki) barLaki.style.width = `${Math.min((laki / maxRef) * 100, 100)}%`;
    if (barPerempuan) barPerempuan.style.width = `${Math.min((perempuan / maxRef) * 100, 100)}%`;
    if (barKK) barKK.style.width = `${Math.min((keluarga / maxRef) * 100, 100)}%`;
  });
}

function setStatNumbers(data, animate = true) {
  const totalElement = document.getElementById("totalPenduduk");
  const lakiElement = document.getElementById("lakiPenduduk");
  const perempuanElement = document.getElementById("perempuanPenduduk");
  const kkElement = document.getElementById("totalKK");

  const total = Number(data?.total) || 0;
  const laki = Number(data?.laki) || 0;
  const perempuan = Number(data?.perempuan) || 0;
  const keluarga = Number(data?.keluarga) || 0;

  updateStatBars(data);

  if (animate && !prefersReducedMotion()) {
    animateNumber(totalElement, total, 900);
    animateNumber(lakiElement, laki, 900);
    animateNumber(perempuanElement, perempuan, 900);
    animateNumber(kkElement, keluarga, 900);
    return;
  }

  if (totalElement) totalElement.textContent = total.toLocaleString("id-ID");
  if (lakiElement) lakiElement.textContent = laki.toLocaleString("id-ID");
  if (perempuanElement) perempuanElement.textContent = perempuan.toLocaleString("id-ID");
  if (kkElement) kkElement.textContent = keluarga.toLocaleString("id-ID");
}

function setStatsUnavailable() {
  const totalElement = document.getElementById("totalPenduduk");
  const lakiElement = document.getElementById("lakiPenduduk");
  const perempuanElement = document.getElementById("perempuanPenduduk");
  const kkElement = document.getElementById("totalKK");
  const statusEl = document.getElementById("statsStatus");

  if (totalElement) totalElement.textContent = "-";
  if (lakiElement) lakiElement.textContent = "-";
  if (perempuanElement) perempuanElement.textContent = "-";
  if (kkElement) kkElement.textContent = "-";
  if (statusEl) statusEl.textContent = "Data statistik belum dapat dimuat. Menampilkan data terakhir jika tersedia.";
}

async function loadStatistik() {
  const cachedData = getStatsFromCache();
  const statusEl = document.getElementById("statsStatus");

  if (cachedData) {
    setStatNumbers(cachedData, false);
  }

  try {
    const response = await fetchWithTimeout(`${API_URL}/penduduk/stats`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Gagal memuat statistik (${response.status})`);
    }

    const data = await response.json();

    setStatNumbers(data, !cachedData);
    saveStatsToCache(data);
    if (statusEl) statusEl.textContent = "";
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("Request statistik dibatalkan karena timeout.");
    } else {
      console.error("Gagal memuat statistik:", error);
    }

    if (!cachedData) {
      setStatsUnavailable();
    } else if (statusEl) {
      statusEl.textContent = "Menampilkan data tersimpan sebelumnya.";
    }
  }
}

function animateNumber(element, end, duration = 900) {
  if (!element) return;

  if (prefersReducedMotion()) {
    element.textContent = Number(end || 0).toLocaleString("id-ID");
    return;
  }

  const start = 0;
  const startTime = performance.now();

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.floor(start + (end - start) * easeOutCubic(progress));
    element.textContent = value.toLocaleString("id-ID");

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}