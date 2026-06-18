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

function togglePassword() {
  const input = document.getElementById("password");
  const toggle = document.querySelector(".toggle-password");

  if (!input || !toggle) return;

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  toggle.classList.toggle("is-visible", isPassword);
  toggle.setAttribute("aria-label", isPassword ? "Sembunyikan password" : "Tampilkan password");
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
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage("error", data.message || "Username atau password salah");
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

document.addEventListener("DOMContentLoaded", function () {
  const inputs = document.querySelectorAll("#username, #password");

  inputs.forEach(input => {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        login();
      }
    });
  });

  const usernameInput = document.getElementById("username");
  if (usernameInput) {
    setTimeout(() => {
      try {
        usernameInput.focus();
      } catch (error) {
        console.warn("Autofocus diblokir browser:", error);
      }
    }, 50);
  }
});