const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api";

const KODE_DESA = "2006";
const THEME_KEY = "desa_motabang_theme";
const LIMIT = 10;

let currentPage = 1;
let totalPages = 1;
let searchTimeout;
let currentEditId = null;
let sortKey = null;
let sortDir = "asc";
let activeJenisChip = "";

document.addEventListener("DOMContentLoaded", function () {
  initTheme();
  initializeForm();
  populateTahunFilter();
  loadStatistics();
  loadRegister(1);
  setupPreviewUpdate();
  setupSortableHeaders();
  setupKeyboardShortcuts();
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

function initializeForm() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("tanggalSurat").value = today;
  attachLiveValidation();
}

/* ---------------- Validasi ringan per-field (visual only) ---------------- */
function attachLiveValidation() {
  const fields = ["jenisSurat", "tanggalSurat", "perihal", "bersangkutan"];
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evt, () => {
      const ok = el.value && el.value.trim() !== "";
      el.classList.toggle("field-valid", !!ok);
    });
  });
}

function populateTahunFilter() {
  const select = document.getElementById("filterTahun");
  const currentYear = new Date().getFullYear();

  select.innerHTML = "";

  for (let year = currentYear; year >= currentYear - 5; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    if (year === currentYear) option.selected = true;
    select.appendChild(option);
  }
}

async function loadStatistics() {
  const totalEl = document.getElementById("totalSurat");
  const bulanEl = document.getElementById("bulanIni");
  const ringTotal = document.getElementById("ringTotalSurat");
  const ringBulan = document.getElementById("ringBulanIni");

  if (totalEl) totalEl.classList.add("loading");
  if (bulanEl) bulanEl.classList.add("loading");

  try {
    const tahun = document.getElementById("filterTahun").value || new Date().getFullYear();
    const res = await fetch(`${API_URL}/register-surat/stats?tahun=${tahun}`);
    const data = await res.json();

    if (totalEl) {
      totalEl.classList.remove("loading");
      animateCounter(totalEl, 0, data.total || 0, 900);
    }
    if (bulanEl) {
      bulanEl.classList.remove("loading");
      animateCounter(bulanEl, 0, data.bulanIni || 0, 900);
    }

    fillStatRing(ringTotal, data.total || 0);
    fillStatRing(ringBulan, data.bulanIni || 0);

    document.getElementById("nomorTerakhir").textContent = data.nomorTerakhir || "-";
  } catch (error) {
    console.error("Error loading statistics:", error);
    if (totalEl) {
      totalEl.classList.remove("loading");
      totalEl.textContent = "-";
    }
    if (bulanEl) {
      bulanEl.classList.remove("loading");
      bulanEl.textContent = "-";
    }
  }
}

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

/* ---------------- Preview nomor surat hidup (signature interaction) ---------------- */
function setupPreviewUpdate() {
  const jenisSurat = document.getElementById("jenisSurat");
  const tanggalSurat = document.getElementById("tanggalSurat");

  jenisSurat.addEventListener("change", updatePreview);
  tanggalSurat.addEventListener("change", updatePreview);
}

function renderPreviewPlaceholder(text) {
  const wrap = document.getElementById("previewSegments");
  wrap.innerHTML = `<span class="seg placeholder">${escapeHtml(text)}</span>`;
}

function renderPreviewLoading() {
  const wrap = document.getElementById("previewSegments");
  wrap.innerHTML = `<span class="seg placeholder"><span class="preview-spinner" aria-hidden="true"></span>&nbsp; Menyusun nomor...</span>`;
}

function renderPreviewSegments(parts) {
  const wrap = document.getElementById("previewSegments");
  wrap.innerHTML = "";

  parts.forEach((part, index) => {
    const span = document.createElement("span");
    span.className = part.sep ? "seg sep" : "seg";
    span.textContent = part.text;
    if (!prefersReducedMotion()) {
      span.style.animationDelay = `${index * 55}ms`;
    } else {
      span.style.opacity = "1";
      span.style.transform = "none";
    }
    wrap.appendChild(span);
  });
}

async function updatePreview() {
  const jenis = document.getElementById("jenisSurat").value;
  const tanggal = document.getElementById("tanggalSurat").value;

  if (!jenis || !tanggal) {
    renderPreviewPlaceholder("Pilih jenis surat dan tanggal untuk melihat preview");
    return;
  }

  renderPreviewLoading();

  try {
    const tahun = new Date(tanggal).getFullYear();
    const bulan = new Date(tanggal).getMonth() + 1;
    const res = await fetch(`${API_URL}/register-surat/next-number?tahun=${tahun}`);
    const data = await res.json();

    const nomorUrut = String(data.nextNumber).padStart(3, "0");
    const romawi = bulanRomawi(bulan);

    const parts = [
      { text: nomorUrut },
      { text: "/", sep: true },
      { text: jenis },
      { text: "/", sep: true },
      { text: KODE_DESA },
      { text: "/", sep: true },
      { text: romawi },
      { text: "/", sep: true },
      { text: String(tahun) }
    ];

    renderPreviewSegments(parts);
  } catch (error) {
    console.error("Error updating preview:", error);
    renderPreviewPlaceholder("Gagal memuat preview nomor surat");
  }
}

function bulanRomawi(bulan) {
  const map = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return map[bulan - 1] || "I";
}

async function simpanRegister(event) {
  if (event) event.preventDefault();

  const jenisEl = document.getElementById("jenisSurat");
  const tanggalEl = document.getElementById("tanggalSurat");
  const perihalEl = document.getElementById("perihal");
  const bersangkutanEl = document.getElementById("bersangkutan");

  const jenis = jenisEl.value.trim();
  const tanggal = tanggalEl.value;
  const perihal = perihalEl.value.trim();
  const bersangkutan = bersangkutanEl.value.trim();

  const missing = [];
  if (!jenis) missing.push(jenisEl);
  if (!tanggal) missing.push(tanggalEl);
  if (!perihal) missing.push(perihalEl);
  if (!bersangkutan) missing.push(bersangkutanEl);

  if (missing.length) {
    showNotification("Semua field wajib diisi.", "error");
    missing.forEach((el) => {
      el.classList.add("field-shake");
      setTimeout(() => el.classList.remove("field-shake"), 420);
    });
    missing[0].focus();
    return;
  }

  const btnSimpan = document.getElementById("btnSimpan");
  btnSimpan.disabled = true;
  const originalLabel = btnSimpan.innerHTML;
  btnSimpan.innerHTML = `<span class="preview-spinner" aria-hidden="true"></span> Menyimpan...`;

  try {
    const response = await fetch(`${API_URL}/register-surat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ jenis, tanggal, perihal, bersangkutan })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Gagal menyimpan register");
    }

    showNotification(`Register berhasil disimpan. Nomor: ${result.nomorSurat}`, "success");
    resetForm();
    loadRegister(1);
    loadStatistics();
  } catch (error) {
    console.error("Error saving register:", error);
    showNotification(error.message || "Terjadi kesalahan saat menyimpan data.", "error");
  } finally {
    btnSimpan.disabled = false;
    btnSimpan.innerHTML = originalLabel;
  }
}

function resetForm() {
  document.getElementById("formRegister").reset();
  document.getElementById("tanggalSurat").value = new Date().toISOString().split("T")[0];
  renderPreviewPlaceholder("Pilih jenis surat dan tanggal untuk melihat preview");

  ["jenisSurat", "tanggalSurat", "perihal", "bersangkutan"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("field-valid");
  });
}

/* ---------------- Tabel: load, sort, search, highlight ---------------- */
function setupSortableHeaders() {
  document.querySelectorAll(".data-table thead th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = "asc";
      }
      updateSortHeaderUI();
      loadRegister(1);
    });
  });
}

function updateSortHeaderUI() {
  document.querySelectorAll(".data-table thead th.sortable").forEach((th) => {
    const isActive = th.dataset.sortKey === sortKey;
    th.classList.toggle("sort-active", isActive);
    th.classList.toggle("sort-desc", isActive && sortDir === "desc");
  });
}

function setJenisChip(value, btn) {
  activeJenisChip = value;
  document.querySelectorAll(".chip[data-jenis]").forEach((c) => c.classList.remove("active"));
  if (btn) btn.classList.add("active");
  loadRegister(1);
}

function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadRegister(1);
  }, 350);
}

function handleFilter() {
  loadStatistics();
  loadRegister(1);
}

function changePage(direction) {
  const nextPage = currentPage + direction;
  if (nextPage < 1 || nextPage > totalPages) return;
  loadRegister(nextPage);
}

function renderSkeletonRows(count) {
  const tbody = document.getElementById("tabelRegister");
  let rows = "";
  for (let i = 0; i < count; i++) {
    rows += `
      <tr>
        <td colspan="7">
          <div class="skeleton-row">
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
          </div>
        </td>
      </tr>
    `;
  }
  tbody.innerHTML = rows;
}

function renderEmptyState(message) {
  const tbody = document.getElementById("tabelRegister");
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="table-state">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6">
            <path d="M7 3.75H14L19 8.75V19.25C19 20.2165 18.2165 21 17.25 21H7C5.89543 21 5 20.1046 5 19V5.75C5 4.64543 5.89543 3.75 7 3.75Z" stroke-linejoin="round"/>
            <path d="M14 3.75V8.75H19" stroke-linejoin="round"/>
            <path d="M9 13.5H15M9 16.5H12" stroke-linecap="round"/>
          </svg>
          <strong>Belum ada data</strong>
          <span>${escapeHtml(message)}</span>
        </div>
      </td>
    </tr>
  `;
}

async function loadRegister(page = 1) {
  currentPage = page;

  const tahun = document.getElementById("filterTahun").value || new Date().getFullYear();
  const search = document.getElementById("searchSurat")?.value || "";
  const tbody = document.getElementById("tabelRegister");

  renderSkeletonRows(5);

  try {
    const params = new URLSearchParams({
      tahun: tahun,
      search: search,
      page: page,
      limit: LIMIT
    });
    if (activeJenisChip) params.set("jenis", activeJenisChip);
    if (sortKey) {
      params.set("sortBy", sortKey);
      params.set("sortDir", sortDir);
    }

    const res = await fetch(`${API_URL}/register-surat?${params.toString()}`);
    const data = await res.json();
    totalPages = data.totalPages || 1;

    if (!data.data || data.data.length === 0) {
      renderEmptyState(
        search
          ? `Tidak ada hasil untuk "${search}". Coba kata kunci lain.`
          : "Belum ada data register surat untuk filter ini."
      );
      updatePagination();
      updateTableMeta(0);
      return;
    }

    tbody.innerHTML = data.data
      .map((item, index) => {
        const rowDelay = prefersReducedMotion() ? 0 : index * 40;
        return `
      <tr style="animation-delay:${rowDelay}ms" data-id="${item.id}">
        <td>${(currentPage - 1) * LIMIT + index + 1}</td>
        <td class="cell-nomor">${highlightMatch(item.nomor_surat || "-", search)}</td>
        <td>${formatDate(item.tanggal_surat)}</td>
        <td><span class="badge-jenis">${escapeHtml(item.jenis_surat || "-")}</span></td>
        <td>${highlightMatch(item.perihal || "-", search)}</td>
        <td>${highlightMatch(item.bersangkutan || "-", search)}</td>
        <td>
          <button class="btn-edit" type="button" onclick="editRegister(${item.id})">Edit</button>
          <button class="btn-delete" type="button" onclick="hapusRegister(${item.id}, this)">Hapus</button>
        </td>
      </tr>
    `;
      })
      .join("");

    updatePagination();
    updateTableMeta(data.total ?? data.data.length);
  } catch (error) {
    console.error("Error loading register:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="table-state">
          <div class="empty-state">
            <strong>Gagal memuat data</strong>
            <span>Periksa koneksi lalu coba muat ulang halaman.</span>
          </div>
        </td>
      </tr>
    `;
  }
}

function updateTableMeta(total) {
  const meta = document.getElementById("tableMeta");
  if (!meta) return;
  meta.textContent = total ? `${Number(total).toLocaleString("id-ID")} data ditemukan` : "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const trimmed = query.trim();
  if (!trimmed) return safe;

  try {
    const re = new RegExp(`(${escapeRegex(trimmed)})`, "ig");
    return safe.replace(re, "<mark class=\"hl\">$1</mark>");
  } catch (error) {
    return safe;
  }
}

function updatePagination() {
  const pageInfo = document.getElementById("pageInfo");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

/* ---------------- Edit / hapus ---------------- */
async function editRegister(id) {
  try {
    const res = await fetch(`${API_URL}/register-surat/${id}`);
    const data = await res.json();

    currentEditId = id;
    document.getElementById("editId").value = data.id || "";
    document.getElementById("editNomorSurat").value = data.nomor_surat || "";
    document.getElementById("editTanggalSurat").value = normalizeDateInput(data.tanggal_surat);
    document.getElementById("editJenisSurat").value = data.jenis_surat || "";
    document.getElementById("editPerihal").value = data.perihal || "";
    document.getElementById("editBersangkutan").value = data.bersangkutan || "";

    openModal();
  } catch (error) {
    console.error("Error loading detail:", error);
    showNotification("Gagal memuat data register.", "error");
  }
}

async function updateRegister() {
  const id = currentEditId || document.getElementById("editId").value;
  if (!id) {
    showNotification("Data register tidak ditemukan.", "error");
    return;
  }

  const payload = {
    tanggal: document.getElementById("editTanggalSurat").value,
    jenis: document.getElementById("editJenisSurat").value,
    perihal: document.getElementById("editPerihal").value.trim(),
    bersangkutan: document.getElementById("editBersangkutan").value.trim()
  };

  const btnUpdate = document.getElementById("btnUpdate");
  const originalLabel = btnUpdate ? btnUpdate.innerHTML : "";
  if (btnUpdate) {
    btnUpdate.disabled = true;
    btnUpdate.innerHTML = `<span class="preview-spinner" aria-hidden="true"></span> Menyimpan...`;
  }

  try {
    const res = await fetch(`${API_URL}/register-surat/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || "Gagal memperbarui data");
    }

    closeModal();
    loadRegister(currentPage);
    loadStatistics();
    showNotification("Data register berhasil diperbarui.", "success");
  } catch (error) {
    console.error("Update error:", error);
    showNotification(error.message || "Terjadi kesalahan saat update data.", "error");
  } finally {
    if (btnUpdate) {
      btnUpdate.disabled = false;
      btnUpdate.innerHTML = originalLabel;
    }
  }
}

async function hapusRegister(id, btn) {
  const confirmDelete = confirm("Yakin ingin menghapus register surat ini?");
  if (!confirmDelete) return;

  const row = btn ? btn.closest("tr") : null;

  try {
    const res = await fetch(`${API_URL}/register-surat/${id}`, {
      method: "DELETE"
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || "Gagal menghapus data");
    }

    if (row && !prefersReducedMotion()) {
      row.classList.add("row-removing");
      setTimeout(() => {
        loadRegister(currentPage);
        loadStatistics();
      }, 260);
    } else {
      loadRegister(currentPage);
      loadStatistics();
    }

    showNotification("Data register berhasil dihapus.", "success");
  } catch (error) {
    console.error("Delete error:", error);
    showNotification(error.message || "Terjadi kesalahan saat menghapus data.", "error");
  }
}

/* ---------------- Modal ---------------- */
function openModal() {
  const modal = document.getElementById("editModal");
  modal.style.display = "block";
  requestAnimationFrame(() => modal.classList.add("open"));
  document.addEventListener("keydown", handleModalEscape);
}

function closeModal() {
  const modal = document.getElementById("editModal");
  modal.classList.remove("open");
  document.removeEventListener("keydown", handleModalEscape);
  setTimeout(() => {
    modal.style.display = "none";
  }, 250);
  currentEditId = null;
}

function handleModalEscape(e) {
  if (e.key === "Escape") closeModal();
}

function normalizeDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

/* ---------------- Notifikasi ---------------- */
const NOTIF_ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8.5h.01M11 11.5h1v5h1"/></svg>`
};

function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");
  const messageBox = document.getElementById("notificationMessage");
  const iconBox = document.getElementById("notificationIcon");

  notification.className = `notification ${type}`;
  messageBox.textContent = message;
  iconBox.innerHTML = NOTIF_ICONS[type] || NOTIF_ICONS.info;

  requestAnimationFrame(() => notification.classList.add("show"));

  clearTimeout(notification._timeout);
  notification._timeout = setTimeout(() => {
    notification.classList.remove("show");
  }, 3200);
}

/* ---------------- Keyboard shortcut ---------------- */
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", function (e) {
    const modalOpen = document.getElementById("editModal").classList.contains("open");
    if (modalOpen) return;

    if (e.altKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      document.getElementById("jenisSurat").focus();
    }

    if (e.altKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      document.getElementById("searchSurat").focus();
    }

    if (e.altKey && e.key.toLowerCase() === "q") {
      e.preventDefault();
      logout();
    }
  });
}

function logout() {
  const confirmed = confirm("Logout dari halaman register surat?");
  if (!confirmed) return;

  try {
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("userLogin");
  } catch (error) {
    console.error("Storage error:", error);
  }

  window.location.href = "login.html";
}

window.onclick = function (event) {
  const modal = document.getElementById("editModal");
  if (event.target === modal) {
    closeModal();
  }
};