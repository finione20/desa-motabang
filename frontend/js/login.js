const THEME_KEY = "desa_motabang_theme";

function safeStorage(action, key, value = null) {
  try {
    if (action === "get") return window.localStorage.getItem(key);
    if (action === "set") return window.localStorage.setItem(key, value);
    if (action === "remove") return window.localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.warn("Storage tidak tersedia:", error);
    return null;
  }
}

const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api";

/* ---------------- Theme (gelap / terang) ---------------- */
function initTheme() {
  const toggle = document.getElementById("themeToggle");
  const root = document.documentElement;

  const saved = safeStorage("get", THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (prefersDark ? "dark" : "light");

  applyTheme(initial);

  if (!toggle) return;

  toggle.addEventListener("click", function () {
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    safeStorage("set", THEME_KEY, next);
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

function togglePassword() {
  const input = document.getElementById("password");
  const toggle = document.querySelector(".toggle-password");

  if (!input || !toggle) return;

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  toggle.classList.toggle("is-visible", isPassword);
  toggle.setAttribute(
    "aria-label",
    isPassword ? "Sembunyikan password" : "Tampilkan password"
  );
}

function showMessage(type, text) {
  const result = document.getElementById("result");
  if (!result) return;

  result.className = "message";
  result.textContent = "";
  void result.offsetWidth;
  result.classList.add("show", type);
  result.textContent = text;
}

function saveLoginData(user) {
  try {
    safeStorage("set", "userLogin", JSON.stringify(user));
    return true;
  } catch (error) {
    console.error("Storage error:", error);
    return false;
  }
}

async function login() {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const button = document.getElementById("btnLogin");

  if (!usernameInput || !passwordInput || !button) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    showMessage("error", "Username dan password wajib diisi");
    return;
  }

  if (username.length < 3) {
    showMessage("error", "Username minimal 3 karakter");
    return;
  }

  button.disabled = true;
  button.classList.add("loading");

  try {
    const payload = { username, password };
    console.log("Payload login dikirim:", payload);

    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const rawText = await res.text();
    console.log("Status login:", res.status);
    console.log("Response mentah login:", rawText);

    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseError) {
      console.error("Gagal parse JSON:", parseError);
      showMessage("error", "Response server bukan JSON yang valid.");
      return;
    }

    if (!res.ok) {
      showMessage("error", data.message || `Login gagal (${res.status})`);
      return;
    }

    if (!data.user) {
      showMessage("error", "Data login tidak valid");
      return;
    }

    const saved = saveLoginData(data.user);

    if (!saved) {
      showMessage("error", "Browser memblokir penyimpanan sesi login.");
      return;
    }

    showMessage("success", "Login berhasil, mengalihkan...");

    setTimeout(() => {
      window.location.href = "pilih.html";
    }, 800);
  } catch (error) {
    console.error("Login error:", error);
    showMessage("error", "Server tidak dapat dihubungi. Coba lagi nanti.");
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
  }
}

/* ---------------- Sequence intro "Gerbang Desa" ---------------- */
function initGateIntro() {
  const body = document.body;
  const gateIntro = document.getElementById("gateIntro");
  const loginShell = document.getElementById("loginShell");

  if (!gateIntro || !loginShell) {
    body.classList.remove("is-entering");
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    body.classList.remove("is-entering");
    gateIntro.classList.add("gate-hidden");
    loginShell.classList.add("gate-open", "content-revealed");
    return;
  }

  // Tahap 1: logo + ring tampil sendirian (durasi diatur lewat CSS animation di gateIntro)
  // Tahap 2: setelah jeda, gerbang (gateIntro) memudar dan dua panel terbuka
  const GATE_HOLD_MS = 1500;
  const PANEL_OPEN_MS = 850;

  setTimeout(() => {
    gateIntro.classList.add("gate-hidden");
    loginShell.classList.add("gate-open");
    body.classList.remove("is-entering");

    // Tahap 3: setelah daun gerbang terbuka, item form muncul satu per satu
    setTimeout(() => {
      loginShell.classList.add("content-revealed");
    }, PANEL_OPEN_MS * 0.4);
  }, GATE_HOLD_MS);
}

document.addEventListener("DOMContentLoaded", function () {
  initGateIntro();
  initTheme();

  const inputs = document.querySelectorAll("#username, #password");

  inputs.forEach((input) => {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        login();
      }
    });
  });

  const usernameInput = document.getElementById("username");
  if (usernameInput) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const focusDelay = reduceMotion ? 50 : 2050;
    setTimeout(() => {
      try {
        usernameInput.focus();
      } catch (error) {
        console.warn("Autofocus diblokir browser:", error);
      }
    }, focusDelay);
  }
});