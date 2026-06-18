const API_URL = "http://localhost:3000/api";
const STATS_CACHE_KEY = "desa_motabang_stats_cache";
const STATS_TIMEOUT = 10000;

document.addEventListener("DOMContentLoaded", function () {
  initYear();
  initNavigation();
  initBackToTop();
  initScrollAnimations();
  initSmoothScroll();
  initMobileNav();
  loadStatistik();
});

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

function initScrollAnimations() {
  const animateElements = document.querySelectorAll(".animate-on-scroll");

  if (!animateElements.length) return;

  if (prefersReducedMotion()) {
    animateElements.forEach((el) => el.classList.add("animated"));
    return;
  }

  if (!("IntersectionObserver" in window)) {
    animateElements.forEach((el) => el.classList.add("animated"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
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

function setStatNumbers(data, animate = true) {
  const totalElement = document.getElementById("totalPenduduk");
  const lakiElement = document.getElementById("lakiPenduduk");
  const perempuanElement = document.getElementById("perempuanPenduduk");
  const kkElement = document.getElementById("totalKK");

  const total = Number(data?.total) || 0;
  const laki = Number(data?.laki) || 0;
  const perempuan = Number(data?.perempuan) || 0;
  const keluarga = Number(data?.keluarga) || 0;

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

  if (totalElement) totalElement.textContent = "-";
  if (lakiElement) lakiElement.textContent = "-";
  if (perempuanElement) perempuanElement.textContent = "-";
  if (kkElement) kkElement.textContent = "-";
}

async function loadStatistik() {
  const cachedData = getStatsFromCache();

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
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("Request statistik dibatalkan karena timeout.");
    } else {
      console.error("Gagal memuat statistik:", error);
    }

    if (!cachedData) {
      setStatsUnavailable();
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