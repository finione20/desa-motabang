const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api";

const THEME_KEY = "desa_motabang_theme";

document.addEventListener("DOMContentLoaded", function () {
  initTheme();
  initYear();
  loadUserInfo();
  loadQuickStats();
  setGreeting();
  initMenuTilt();
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

function loadUserInfo() {
  const userNameElement = document.getElementById("userName");
  if (!userNameElement) return;

  try {
    const userLogin = localStorage.getItem("userLogin");

    if (!userLogin) {
      userNameElement.textContent = "Admin";
      return;
    }

    const user = JSON.parse(userLogin);
    userNameElement.textContent = user.username || user.nama_lengkap || "Admin";
  } catch (error) {
    console.error("Error parsing user data:", error);
    userNameElement.textContent = "Admin";
  }
}

/* ---------------- Sapaan dengan orb visual matahari/bulan ---------------- */
function setGreeting() {
  const greetingBadge = document.getElementById("greetingBadge");
  const greetingText = document.getElementById("greetingText");
  const greetingOrb = document.getElementById("greetingOrb");
  if (!greetingBadge || !greetingText) return;

  const hour = new Date().getHours();
  let greeting = "Selamat Datang";
  let orbGradient = "radial-gradient(circle at 35% 30%, #ffe39a, #f3b431)";

  if (hour >= 5 && hour < 12) {
    greeting = "Selamat Pagi";
    orbGradient = "radial-gradient(circle at 35% 30%, #fff3b0, #f7b733)";
  } else if (hour >= 12 && hour < 15) {
    greeting = "Selamat Siang";
    orbGradient = "radial-gradient(circle at 35% 30%, #ffe39a, #f3941f)";
  } else if (hour >= 15 && hour < 18) {
    greeting = "Selamat Sore";
    orbGradient = "radial-gradient(circle at 35% 30%, #ffc18a, #e8743b)";
  } else {
    greeting = "Selamat Malam";
    orbGradient = "radial-gradient(circle at 35% 30%, #cfd9ff, #4a5b9e)";
  }

  greetingText.textContent = greeting;

  if (greetingOrb) {
    greetingOrb.style.setProperty("--greeting-orb-bg", orbGradient);
    greetingOrb.style.background = orbGradient;
  }
}

async function loadQuickStats() {
  await Promise.all([loadPendudukStats(), loadRegisterStats()]);
}

async function loadPendudukStats() {
  const totalElement = document.getElementById("totalPenduduk");
  const ringElement = document.getElementById("ringPenduduk");
  if (!totalElement) return;

  totalElement.classList.add("loading");
  totalElement.textContent = "";

  try {
    const response = await fetch(`${API_URL}/penduduk/stats`);
    if (!response.ok) throw new Error("Failed to fetch penduduk stats");

    const data = await response.json();
    totalElement.classList.remove("loading");
    animateCounter(totalElement, 0, data.total || 0, 1200);
    fillStatRing(ringElement, data.total || 0);
  } catch (error) {
    console.error("Error loading penduduk stats:", error);
    totalElement.classList.remove("loading");
    totalElement.textContent = "-";
  }
}

async function loadRegisterStats() {
  const totalElement = document.getElementById("totalSurat");
  const ringElement = document.getElementById("ringSurat");
  if (!totalElement) return;

  totalElement.classList.add("loading");
  totalElement.textContent = "";

  try {
    const currentYear = new Date().getFullYear();
    const response = await fetch(`${API_URL}/register-surat/stats?tahun=${currentYear}`);
    if (!response.ok) throw new Error("Failed to fetch register stats");

    const data = await response.json();
    totalElement.classList.remove("loading");
    animateCounter(totalElement, 0, data.total || 0, 1200);
    fillStatRing(ringElement, data.total || 0);
  } catch (error) {
    console.error("Error loading register stats:", error);
    totalElement.classList.remove("loading");
    totalElement.textContent = "-";
  }
}

/* Mengisi ring statistik. Karena ini bukan persentase dari suatu total yang
   diketahui, ring dipakai sebagai elemen visual "terisi penuh begitu data
   berhasil dimuat" — bukan representasi proporsi. */
function fillStatRing(ringElement, value) {
  if (!ringElement) return;

  const hasValue = Number(value) > 0;
  const circumference = 100.5;
  const offset = hasValue ? 0 : circumference;

  if (prefersReducedMotion()) {
    ringElement.style.transition = "none";
  }

  requestAnimationFrame(() => {
    ringElement.style.strokeDashoffset = offset;
  });
}

function animateCounter(element, start, end, duration) {
  if (!element) return;

  if (prefersReducedMotion()) {
    element.textContent = Number(end || 0).toLocaleString("id-ID");
    return;
  }

  const startTime = performance.now();

  function updateCounter(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (end - start) * eased);

    element.textContent = current.toLocaleString("id-ID");

    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    }
  }

  requestAnimationFrame(updateCounter);
}

/* ---------------- Tilt 3D halus pada kartu menu ---------------- */
function initMenuTilt() {
  if (prefersReducedMotion()) return;

  const cards = document.querySelectorAll(".menu-card[data-tilt]");
  if (!cards.length) return;

  const MAX_TILT = 6;

  cards.forEach((card) => {
    card.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;

      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const rx = (x - 0.5) * MAX_TILT * 2;
      const ry = (0.5 - y) * MAX_TILT * 2;

      card.style.setProperty("--rx", `${rx}deg`);
      card.style.setProperty("--ry", `${ry}deg`);
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
    });

    card.addEventListener("pointerleave", function () {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}

function logout() {
  if (confirm("Logout dari sistem? Anda akan diarahkan ke halaman login.")) {
    try {
      localStorage.removeItem("isAdmin");
      localStorage.removeItem("userLogin");
    } catch (error) {
      console.error("Storage error:", error);
    }

    showMessage("Logout berhasil. Sampai jumpa kembali.");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 900);
  }
}

function showMessage(message) {
  const existing = document.querySelector(".toast-message");
  if (existing) existing.remove();

  const messageDiv = document.createElement("div");
  messageDiv.className = "toast-message";
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.style.opacity = "0";
    messageDiv.style.transform = "translate(-50%, -10px)";
    setTimeout(() => messageDiv.remove(), 250);
  }, 2200);
}

document.addEventListener("keydown", function (e) {
  if (e.altKey && e.key === "1") {
    e.preventDefault();
    window.location.href = "admin.html";
  }

  if (e.altKey && e.key === "2") {
    e.preventDefault();
    window.location.href = "register-surat.html";
  }

  if (e.altKey && e.key === "3") {
    e.preventDefault();
    window.location.href = "desa.html";
  }

  if (e.altKey && (e.key === "q" || e.key === "Q")) {
    e.preventDefault();
    logout();
  }
});