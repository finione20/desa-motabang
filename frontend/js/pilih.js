const API_URL = "http://localhost:3000/api";

document.addEventListener("DOMContentLoaded", function () {
  initYear();
  loadUserInfo();
  loadQuickStats();
  setGreeting();
});

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

function setGreeting() {
  const greetingBadge = document.getElementById("greetingBadge");
  if (!greetingBadge) return;

  const hour = new Date().getHours();
  let greeting = "Selamat Datang";

  if (hour >= 5 && hour < 12) {
    greeting = "Selamat Pagi";
  } else if (hour >= 12 && hour < 15) {
    greeting = "Selamat Siang";
  } else if (hour >= 15 && hour < 18) {
    greeting = "Selamat Sore";
  } else {
    greeting = "Selamat Malam";
  }

  greetingBadge.textContent = greeting;
}

async function loadQuickStats() {
  await Promise.all([loadPendudukStats(), loadRegisterStats()]);
}

async function loadPendudukStats() {
  const totalElement = document.getElementById("totalPenduduk");
  if (!totalElement) return;

  totalElement.classList.add("loading");
  totalElement.textContent = "";

  try {
    const response = await fetch(`${API_URL}/penduduk/stats`);
    if (!response.ok) throw new Error("Failed to fetch penduduk stats");

    const data = await response.json();
    totalElement.classList.remove("loading");
    animateCounter(totalElement, 0, data.total || 0, 1200);
  } catch (error) {
    console.error("Error loading penduduk stats:", error);
    totalElement.classList.remove("loading");
    totalElement.textContent = "-";
  }
}

async function loadRegisterStats() {
  const totalElement = document.getElementById("totalSurat");
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
  } catch (error) {
    console.error("Error loading register stats:", error);
    totalElement.classList.remove("loading");
    totalElement.textContent = "-";
  }
}

function animateCounter(element, start, end, duration) {
  if (!element) return;

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