const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api";

const STATS_TIMEOUT = 10000;
let statsCacheMemory = null;
let themeMemory = null;

document.addEventListener("DOMContentLoaded", function () {
  initTheme();
  initYear();
  initNavigation();
  initScrollProgress();
  initBackToTop();
  initRevealAnimations();
  initSmoothScroll();
  initMobileNav();
  initStoryLinks();
  initServiceFilter();
  initServiceAccordion();
  initOpenStatus();
  initCopyPhone();
  loadStatistik();
});

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initTheme() {
  const toggle = document.getElementById("themeToggle");
  const root = document.documentElement;

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = themeMemory || (prefersDark ? "dark" : "light");

  applyTheme(initial);

  if (!toggle) return;

  toggle.addEventListener("click", function () {
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    themeMemory = next;
    applyTheme(next);
  });

  function applyTheme(mode) {
    if (mode === "dark") {
      root.setAttribute("data-theme", "dark");
      toggle?.setAttribute("aria-pressed", "true");
    } else {
      root.removeAttribute("data-theme");
      toggle?.setAttribute("aria-pressed", "false");
    }
  }
}

function initYear() {
  const yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

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

function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section[id]");

  if (!navLinks.length || !sections.length) return;

  function updateActiveLink() {
    let current = "";
    const headerOffset = window.innerWidth <= 820 ? 120 : 146;
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

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (event) {
      const href = this.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      scrollToElement(target);
    });
  });
}

function scrollToSectionId(id) {
  const target = document.getElementById(id);
  if (!target) return;
  scrollToElement(target);
}

function scrollToElement(element) {
  const offset = window.innerWidth <= 820 ? 110 : 132;
  const offsetTop = element.offsetTop - offset;

  window.scrollTo({
    top: Math.max(offsetTop, 0),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

function initStoryLinks() {
  document.querySelectorAll(".story-link[data-target]").forEach((button) => {
    button.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target");
      if (!targetId) return;
      scrollToSectionId(targetId);
    });
  });
}

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
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        entry.target.classList.add("animated");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  animateElements.forEach((el) => observer.observe(el));
}

function initServiceFilter() {
  const input = document.getElementById("serviceSearch");
  const items = document.querySelectorAll(".service-item");
  const countEl = document.getElementById("serviceCount");
  const emptyEl = document.getElementById("serviceEmpty");

  if (!input || !items.length) return;

  function applyFilter() {
    const query = input.value.trim().toLowerCase();
    let visibleCount = 0;

    items.forEach((item) => {
      const title = item.querySelector("h3")?.textContent.toLowerCase() || "";
      const desc = item.querySelector(".service-main p")?.textContent.toLowerCase() || "";
      const keywords = (item.getAttribute("data-keywords") || "").toLowerCase();
      const haystack = `${title} ${desc} ${keywords}`;
      const match = query === "" || haystack.includes(query);

      item.classList.toggle("is-hidden", !match);
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

function initServiceAccordion() {
  const triggers = document.querySelectorAll(".service-card-trigger");
  if (!triggers.length) return;

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", function () {
      const item = this.closest(".service-item");
      const isOpen = this.getAttribute("aria-expanded") === "true";
      const toggle = this.querySelector(".service-toggle");

      this.setAttribute("aria-expanded", isOpen ? "false" : "true");

      if (toggle) {
        toggle.textContent = isOpen ? "+" : "×";
      }

      if (item) {
        item.classList.toggle("is-open", !isOpen);
      }
    });
  });
}

function initOpenStatus() {
  const wrap = document.getElementById("openStatus");
  const textEl = document.getElementById("openStatusText");
  if (!wrap || !textEl) return;

  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const minutesNow = hour * 60 + minute;

  let isOpen = false;
  let message = "";

  if (day >= 1 && day <= 5) {
    isOpen = minutesNow >= 8 * 60 && minutesNow < 16 * 60;
    message = isOpen
      ? "Sedang buka sekarang · 08.00 - 16.00"
      : "Tutup sekarang · buka kembali 08.00";
  } else if (day === 6) {
    isOpen = minutesNow >= 8 * 60 && minutesNow < 12 * 60;
    message = isOpen
      ? "Sedang buka sekarang · 08.00 - 12.00"
      : "Tutup sekarang · jam layanan Sabtu 08.00 - 12.00";
  } else {
    isOpen = false;
    message = "Tutup hari ini · Minggu libur pelayanan";
  }

  wrap.classList.remove("is-open", "is-closed");
  wrap.classList.add(isOpen ? "is-open" : "is-closed");
  textEl.textContent = message;
}

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
  statsCacheMemory = {
    timestamp: Date.now(),
    data,
  };
}

function getStatsFromCache() {
  if (!statsCacheMemory || !statsCacheMemory.data) return null;
  return statsCacheMemory.data;
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

  const bars = ["barTotal", "barLaki", "barPerempuan", "barKK"];
  bars.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.width = "0%";
  });

  if (statusEl) {
    statusEl.textContent = "Data statistik belum dapat dimuat. Menampilkan data terakhir jika tersedia.";
  }
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

    if (statusEl) {
      statusEl.textContent = "";
    }
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