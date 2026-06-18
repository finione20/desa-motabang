const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
let sessionTimer = null;

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

function redirectToLogin() {
  window.location.href = "login.html";
}

function getLoggedUser() {
  const raw = safeStorage("get", "userLogin");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    safeStorage("remove", "userLogin");
    return null;
  }
}

function checkAuth() {
  const user = getLoggedUser();

  if (!user) {
    redirectToLogin();
    return false;
  }

  return true;
}

function displayUserInfo() {
  const user = getLoggedUser();
  if (!user) return;

  const userElement = document.querySelector(".user-info span:last-child");
  if (userElement) {
    userElement.textContent = user.username || user.nama_lengkap || "Admin";
  }
}

function clearAuth() {
  safeStorage("remove", "userLogin");
  safeStorage("remove", "isAdmin");
}

function logout() {
  const confirmed = confirm("Logout dari panel admin?");
  if (!confirmed) return;

  clearAuth();
  redirectToLogin();
}

function handleSessionExpired() {
  alert("Sesi Anda telah berakhir. Silakan login kembali.");
  clearAuth();
  redirectToLogin();
}

function resetSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(handleSessionExpired, SESSION_TIMEOUT);
}

function initSessionTracker() {
  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(eventName => {
    document.addEventListener(eventName, resetSessionTimer, { passive: true });
  });

  resetSessionTimer();
}

window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    checkAuth();
  }
});

if (!checkAuth()) {
  throw new Error("Unauthorized access");
}

displayUserInfo();
initSessionTracker();