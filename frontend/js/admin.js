let importedData = [];
let currentPage = 1;
let currentSearch = "";
let currentDusun = "";
let currentJK = "";
let totalPage = 1;
let totalData = 0;
let searchDebounce = null;
let chartInstances = {};

const LIMIT = 10;
const THEME_KEY = "desa_motabang_theme";
const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initClock();
  initNavIndicator();
  initDropzone();
  initModalDismiss();
  loadDashboardStats();
  populateDusunFilter();
});

/* ================= THEME ================= */
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
    refreshDashboardChartsIfVisible();
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

/* ================= CLOCK ================= */
function initClock() {
  const timeEl = document.getElementById("clockTime");
  const dateEl = document.getElementById("clockDate");
  if (!timeEl || !dateEl) return;

  function tick() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    dateEl.textContent = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }

  tick();
  setInterval(tick, 30000);
}

/* ================= NAV INDICATOR ================= */
function initNavIndicator() {
  const active = document.querySelector(".nav-item.active");
  if (active) moveNavIndicator(active);

  window.addEventListener("resize", () => {
    const current = document.querySelector(".nav-item.active");
    if (current) moveNavIndicator(current);
  });
}

function moveNavIndicator(el) {
  const indicator = document.getElementById("navIndicator");
  const list = document.getElementById("sidebarNavList");
  if (!indicator || !list || !el) return;

  const listRect = list.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const offset = elRect.top - listRect.top;

  indicator.style.transform = `translateY(${offset}px)`;
  indicator.style.height = `${elRect.height}px`;
}

/* ================= PAGE SWITCH ================= */
function showPage(id, el) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  const targetPage = document.getElementById(id);
  if (targetPage) targetPage.classList.add("active");

  document.querySelectorAll(".nav-item[data-page]").forEach(item => item.classList.remove("active"));
  if (el && el.classList.contains("nav-item")) {
    el.classList.add("active");
    moveNavIndicator(el);
  }

  if (id === "dashboard") {
    loadDashboardStats();
  }

  if (id === "penduduk") {
    loadPenduduk(1);
  }
}

/* ================= DASHBOARD STATS (RINGKASAN) ================= */
function loadDashboardStats(manual) {
  if (manual) showToast("Memuat ulang ringkasan dashboard…", "info");

  fetch(`${API_URL}/penduduk/stats`)
    .then(res => {
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    })
    .then(data => {
      const total = Number(data.total || 0);
      const laki = Number(data.laki || 0);
      const perempuan = Number(data.perempuan || 0);
      const keluarga = Number(data.keluarga || 0);

      animateCounter("totalPenduduk", total);
      animateCounter("totalLaki", laki);
      animateCounter("totalPerempuan", perempuan);
      animateCounter("totalKeluarga", keluarga);

      fillRing("ringTotal", total > 0);
      setText("pctLaki", `${total ? Math.round((laki / total) * 100) : 0}%`);
      setText("pctPerempuan", `${total ? Math.round((perempuan / total) * 100) : 0}%`);
      setText("navPendudukCount", total.toLocaleString("id-ID"));
    })
    .catch(error => {
      console.error("Error loading stats:", error);
      ["totalPenduduk", "totalLaki", "totalPerempuan", "totalKeluarga"].forEach(id => setText(id, "-"));
      showToast("Gagal memuat ringkasan dashboard.", "error");
    });

  loadDetailedStats();
}

function fillRing(id, hasValue) {
  const ring = document.getElementById(id);
  if (!ring) return;
  const circumference = 100.5;
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = hasValue ? 0 : circumference;
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = typeof value === "number" ? value.toLocaleString("id-ID") : value;
}

function animateCounter(id, end) {
  const element = document.getElementById(id);
  if (!element) return;

  if (prefersReducedMotion()) {
    element.textContent = Number(end || 0).toLocaleString("id-ID");
    return;
  }

  const start = 0;
  const duration = 900;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (end - start) * eased);
    element.textContent = current.toLocaleString("id-ID");
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ================= STATISTIK LENGKAP (DUSUN, USIA, PEKERJAAN, DLL) ================= */
function loadDetailedStats() {
  fetch(`${API_URL}/penduduk/stats/detail`)
    .then(res => {
      if (!res.ok) throw new Error("Gagal memuat statistik lengkap");
      return res.json();
    })
    .then(data => {
      renderUsiaSummary(data.usia);
      renderDusunTable(data.perDusun);
      setText("totalDusun", Array.isArray(data.perDusun) ? data.perDusun.length : 0);

      renderChartDusun(data.perDusun);
      renderChartUsia(data.usia);
      renderChartGeneric("chartPekerjaan", data.pekerjaan, "bar");
      renderChartGeneric("chartPendidikan", data.pendidikan, "bar");
      renderChartGeneric("chartAgama", data.agama, "doughnut");
      renderChartGeneric("chartStatus", data.statusPerkawinan, "doughnut");
    })
    .catch(error => {
      console.error("Detailed stats error:", error);
      setText("dusunTableSubtitle", "Gagal memuat rincian dusun");
      showToast("Gagal memuat statistik lengkap dashboard.", "error");
    });
}

function refreshDashboardChartsIfVisible() {
  const dashboard = document.getElementById("dashboard");
  if (dashboard && dashboard.classList.contains("active")) {
    loadDetailedStats();
  }
}

function renderUsiaSummary(usia) {
  if (!usia) return;
  setText("usiaRataRata", usia.rataRata || 0);
  setText("usiaTermuda", usia.termuda || 0);
  setText("usiaTertua", usia.tertua || 0);
}

function renderDusunTable(rows) {
  const tbody = document.querySelector("#tabelDusun tbody");
  if (!tbody) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">${emptyState("Belum ada data dusun.")}</td></tr>`;
    setText("dusunTableSubtitle", "Belum ada data dusun");
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row, index) => `
    <tr style="animation-delay:${Math.min(index, 12) * 25}ms">
      <td>${escapeHtml(row.dusun) || "-"}</td>
      <td>${Number(row.jumlah_kk || 0).toLocaleString("id-ID")}</td>
      <td>${Number(row.jumlah_penduduk || 0).toLocaleString("id-ID")}</td>
      <td>${Number(row.laki || 0).toLocaleString("id-ID")}</td>
      <td>${Number(row.perempuan || 0).toLocaleString("id-ID")}</td>
    </tr>
  `
    )
    .join("");

  setText("dusunTableSubtitle", `${rows.length} dusun terdata`);
}

/* ---------- Chart helpers ---------- */
function getThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue("--primary").trim() || "#2f6b45",
    accent: styles.getPropertyValue("--accent").trim() || "#c9882b",
    text: styles.getPropertyValue("--text").trim() || "#17231b",
    muted: styles.getPropertyValue("--text-muted").trim() || "#68776d",
    line: styles.getPropertyValue("--line").trim() || "#d9e3dc",
    surface: styles.getPropertyValue("--surface").trim() || "#ffffff",
  };
}

function chartPalette(count) {
  const base = [
    "#2f6b45", "#c9882b", "#2f5fa8", "#a66b08", "#b42318", "#027a48",
    "#6a4fb6", "#1f7a8c", "#a83279", "#5b8c5a", "#8c6a3f", "#3f6b8c"
  ];
  const out = [];
  for (let i = 0; i < count; i++) out.push(base[i % base.length]);
  return out;
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function baseChartOptions(colors, opts = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: opts.indexAxisY ? "y" : "x",
    animation: prefersReducedMotion() ? false : { duration: 750, easing: "easeOutCubic" },
    plugins: {
      legend: {
        display: opts.legend !== false,
        position: "bottom",
        labels: {
          color: colors.muted,
          font: { family: "Plus Jakarta Sans", size: 11 },
          boxWidth: 12,
          padding: 14
        }
      },
      tooltip: {
        backgroundColor: colors.text,
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        padding: 10,
        cornerRadius: 10,
        displayColors: true
      }
    },
    scales: opts.noScales
      ? {}
      : {
          x: {
            grid: { color: colors.line, display: !opts.indexAxisY },
            ticks: { color: colors.muted, font: { size: 11 } }
          },
          y: {
            grid: { color: colors.line, display: opts.indexAxisY !== true },
            ticks: { color: colors.muted, font: { size: 11 } },
            beginAtZero: true
          }
        }
  };
}

function renderChartDusun(rows) {
  const canvas = document.getElementById("chartDusun");
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart("chartDusun");

  const colors = getThemeColors();
  const data = Array.isArray(rows) ? rows : [];
  const labels = data.map(r => r.dusun);
  const penduduk = data.map(r => Number(r.jumlah_penduduk || 0));
  const kk = data.map(r => Number(r.jumlah_kk || 0));

  if (labels.length === 0) return;

  chartInstances.chartDusun = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Penduduk", data: penduduk, backgroundColor: colors.primary, borderRadius: 8, maxBarThickness: 30 },
        { label: "Kepala Keluarga", data: kk, backgroundColor: colors.accent, borderRadius: 8, maxBarThickness: 30 }
      ]
    },
    options: baseChartOptions(colors, { legend: true })
  });
}

function renderChartUsia(usia) {
  const canvas = document.getElementById("chartUsia");
  if (!canvas || typeof Chart === "undefined" || !usia) return;
  destroyChart("chartUsia");

  const colors = getThemeColors();
  const kategori = usia.kategori || {};
  const labels = [
    "Balita (0-5)",
    "Anak (6-12)",
    "Remaja (13-17)",
    "Dewasa Muda (18-25)",
    "Dewasa (26-45)",
    "Paruh Baya (46-60)",
    "Lansia (60+)"
  ];
  const values = [
    kategori.balita,
    kategori.anak,
    kategori.remaja,
    kategori.dewasaMuda,
    kategori.dewasa,
    kategori.paruhBaya,
    kategori.lansia
  ].map(v => Number(v || 0));

  chartInstances.chartUsia = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Jumlah",
          data: values,
          backgroundColor: chartPalette(labels.length),
          borderRadius: 8,
          maxBarThickness: 26
        }
      ]
    },
    options: baseChartOptions(colors, { legend: false, indexAxisY: true })
  });
}

function renderChartGeneric(canvasId, rows, type) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart(canvasId);

  const colors = getThemeColors();
  const data = Array.isArray(rows) ? rows : [];
  const labels = data.map(r => r.label);
  const values = data.map(r => Number(r.jumlah || 0));

  if (labels.length === 0) return;

  chartInstances[canvasId] = new Chart(canvas.getContext("2d"), {
    type,
    data: {
      labels,
      datasets: [
        {
          label: "Jumlah",
          data: values,
          backgroundColor: chartPalette(labels.length),
          borderRadius: type === "bar" ? 8 : 0,
          borderWidth: type === "doughnut" ? 2 : 0,
          borderColor: colors.surface,
          maxBarThickness: 26
        }
      ]
    },
    options: baseChartOptions(colors, {
      legend: type === "doughnut",
      indexAxisY: type === "bar",
      noScales: type === "doughnut"
    })
  });
}

/* ================= DROPZONE / IMPORT EXCEL ================= */
function initDropzone() {
  const zone = document.getElementById("dropzone");
  const input = document.getElementById("fileExcel");
  if (!zone || !input) return;

  ["dragenter", "dragover"].forEach(evt => {
    zone.addEventListener(evt, e => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach(evt => {
    zone.addEventListener(evt, e => {
      e.preventDefault();
      zone.classList.remove("drag-over");
    });
  });

  zone.addEventListener("drop", e => {
    const file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
    if (file) {
      input.files = e.dataTransfer.files;
      handleFileChosen();
    }
  });
}

function handleFileChosen() {
  const fileInput = document.getElementById("fileExcel");
  const label = document.getElementById("dropzoneFile");
  const text = document.getElementById("dropzoneText");
  const file = fileInput ? fileInput.files[0] : null;

  if (!file || !label || !text) return;

  text.hidden = true;
  label.hidden = false;
  label.textContent = `${file.name} dipilih — klik "Preview Excel" untuk melanjutkan`;
}

function importExcel() {
  const fileInput = document.getElementById("fileExcel");
  const file = fileInput ? fileInput.files[0] : null;

  if (!file) {
    showToast("Pilih berkas Excel terlebih dahulu.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      importedData = rows.map(r => ({
        rw: r.RW || "",
        rt: r.RT || "",
        dusun: r.Dusun || "",
        alamat: r.Alamat || "",
        kode_keluarga: r["Kode Keluarga"] || "",
        nik: r["N I K"] || r.NIK || "",
        nama: r["Nama Anggota Keluarga"] || r.Nama || "",
        jenis_kelamin: r["Jenis Kelamin"] || r.JK || "",
        hubungan: r.Hubungan || "",
        tempat_lahir: r["Tempat Lahir"] || "",
        tanggal_lahir: r["Tanggal Lahir"] || null,
        usia: r.Usia || null,
        status: r.Status || "",
        agama: r.Agama || "",
        gol_darah: r.GDarah || r["Gol Darah"] || "",
        kewarganegaraan: r.Kewarganegaraan || "WNI",
        etnis: r["Etnis / Suku"] || r.Etnis || "",
        pendidikan: r.Pendidikan || "",
        pekerjaan: r.Pekerjaan || ""
      }));

      renderPreviewTable(importedData);

      const badge = document.getElementById("importBadge");
      if (badge) {
        badge.hidden = false;
        badge.textContent = `${importedData.length} baris siap disimpan`;
      }

      showToast(`Preview berhasil dimuat (${importedData.length} baris).`, "success");
    } catch (error) {
      console.error(error);
      showToast("Gagal membaca berkas Excel. Pastikan format file benar.", "error");
    }
  };

  reader.readAsArrayBuffer(file);
}

function renderPreviewTable(data) {
  const tbody = document.querySelector("#tabelPenduduk tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11">${emptyState("Tidak ada data preview.")}</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  data.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.style.animationDelay = `${Math.min(index, 12) * 25}ms`;
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(item.dusun) || "-"}</td>
      <td>${escapeHtml(item.rw) || "-"}/${escapeHtml(item.rt) || "-"}</td>
      <td>${escapeHtml(item.kode_keluarga) || "-"}</td>
      <td>${escapeHtml(item.nik) || "-"}</td>
      <td>${escapeHtml(item.nama) || "-"}</td>
      <td>${escapeHtml(item.jenis_kelamin) || "-"}</td>
      <td>${formatTTL(item.tempat_lahir, item.tanggal_lahir)}</td>
      <td>${item.usia || "-"}</td>
      <td>${escapeHtml(item.alamat) || "-"}</td>
      <td><span class="badge-danger">Preview</span></td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  setPaginationInfo(1, 1);
  setText("tableSubtitle", `Menampilkan ${data.length} baris pratinjau (belum disimpan)`);
}

function saveToDatabase() {
  if (!Array.isArray(importedData) || importedData.length === 0) {
    showToast("Belum ada data preview untuk disimpan.", "error");
    return;
  }

  showConfirm({
    title: "Simpan ke database?",
    message: `${importedData.length} baris data akan ditambahkan ke basis data penduduk.`,
    confirmLabel: "Ya, Simpan",
    onConfirm: () => {
      fetch(`${API_URL}/penduduk/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: importedData })
      })
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            showToast("Data berhasil disimpan ke database.", "success");
            importedData = [];
            const badge = document.getElementById("importBadge");
            if (badge) badge.hidden = true;
            resetDropzone();
            loadDashboardStats();
            loadPenduduk(1);
            populateDusunFilter();
          } else {
            showToast(result.message || "Gagal menyimpan data.", "error");
          }
        })
        .catch(error => {
          console.error("Save error:", error);
          showToast("Terjadi kesalahan saat menyimpan data.", "error");
        });
    }
  });
}

function resetDropzone() {
  const text = document.getElementById("dropzoneText");
  const label = document.getElementById("dropzoneFile");
  const input = document.getElementById("fileExcel");
  if (text) text.hidden = false;
  if (label) label.hidden = true;
  if (input) input.value = "";
}

/* ================= TABLE / LIST ================= */
function loadPenduduk(page = 1) {
  currentPage = page;
  const tbody = document.querySelector("#tabelPenduduk tbody");
  if (tbody) {
    tbody.innerHTML = `
      <tr class="skeleton-row"><td colspan="11"><span class="skeleton-bar"></span></td></tr>
      <tr class="skeleton-row"><td colspan="11"><span class="skeleton-bar"></span></td></tr>
      <tr class="skeleton-row"><td colspan="11"><span class="skeleton-bar"></span></td></tr>
    `;
  }
  setText("tableSubtitle", "Memuat data…");

  const params = new URLSearchParams({
    page: currentPage,
    limit: LIMIT,
    search: currentSearch,
    dusun: currentDusun,
    jk: currentJK
  });

  fetch(`${API_URL}/penduduk?${params.toString()}`)
    .then(res => {
      if (!res.ok) throw new Error("Gagal memuat data");
      return res.json();
    })
    .then(result => {
      renderPendudukTable(result.data || []);
      totalPage = result.totalPage || 1;
      totalData = result.totalData || 0;
      setPaginationInfo(currentPage, totalPage);
      updatePaginationButtons();

      const filterNote = currentSearch || currentDusun || currentJK ? " (terfilter)" : "";
      setText("tableSubtitle", `${totalData.toLocaleString("id-ID")} data ditemukan${filterNote}`);
      toggleFilterResetButton();
    })
    .catch(error => {
      console.error("Load penduduk error:", error);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="11">${emptyState("Gagal memuat data. Coba refresh kembali.")}</td></tr>`;
      }
      setText("tableSubtitle", "Gagal memuat data");
      showToast("Gagal memuat data penduduk.", "error");
    });
}

function renderPendudukTable(data) {
  const tbody = document.querySelector("#tabelPenduduk tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11">${emptyState("Tidak ada data ditemukan untuk filter ini.")}</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  data.forEach((item, index) => {
    const rowNumber = (currentPage - 1) * LIMIT + index + 1;
    const tr = document.createElement("tr");
    tr.style.animationDelay = `${Math.min(index, 12) * 25}ms`;

    tr.innerHTML = `
      <td>${rowNumber}</td>
      <td>${escapeHtml(item.dusun) || "-"}</td>
      <td>${escapeHtml(item.rw) || "-"}/${escapeHtml(item.rt) || "-"}</td>
      <td>${escapeHtml(item.kode_keluarga) || "-"}</td>
      <td>${escapeHtml(item.nik) || "-"}</td>
      <td>${escapeHtml(item.nama) || "-"}</td>
      <td>${escapeHtml(item.jenis_kelamin) || "-"}</td>
      <td>${formatTTL(item.tempat_lahir, item.tanggal_lahir)}</td>
      <td>${item.usia || "-"}</td>
      <td>${escapeHtml(item.alamat) || "-"}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-edit" type="button" title="Edit" onclick="editPenduduk('${item.id}')">✎</button>
          <button class="btn-delete" type="button" title="Hapus" onclick="deletePenduduk('${item.id}', '${escapeHtml(item.nama) || ""}')">×</button>
        </div>
      </td>
    `;

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function emptyState(message) {
  return `
    <div class="table-empty">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none"><rect x="3.5" y="6" width="17" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 10h17" stroke="currentColor" stroke-width="1.6"/><path d="M8 4v4M16 4v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <span>${message}</span>
    </div>
  `;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTTL(tempat, tanggal) {
  if (!tempat && !tanggal) return "-";
  if (!tanggal) return escapeHtml(tempat) || "-";

  const date = new Date(tanggal);
  const formatted = isNaN(date.getTime())
    ? escapeHtml(tanggal)
    : date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

  return `${escapeHtml(tempat) || "-"}, ${formatted}`;
}

/* ================= SEARCH & FILTER ================= */
function handleSearch() {
  const input = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClear");
  const value = input ? input.value.trim() : "";

  if (clearBtn) clearBtn.hidden = value.length === 0;

  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentSearch = value;
    loadPenduduk(1);
  }, 320);
}

function clearSearch() {
  const input = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClear");
  if (input) input.value = "";
  if (clearBtn) clearBtn.hidden = true;
  currentSearch = "";
  loadPenduduk(1);
}

function handleFilter() {
  const dusun = document.getElementById("filterDusun");
  const jk = document.getElementById("filterJK");

  currentDusun = dusun ? dusun.value : "";
  currentJK = jk ? jk.value : "";
  loadPenduduk(1);
}

function resetFilters() {
  currentSearch = "";
  currentDusun = "";
  currentJK = "";

  const search = document.getElementById("searchInput");
  const dusun = document.getElementById("filterDusun");
  const jk = document.getElementById("filterJK");
  const clearBtn = document.getElementById("searchClear");

  if (search) search.value = "";
  if (dusun) dusun.value = "";
  if (jk) jk.value = "";
  if (clearBtn) clearBtn.hidden = true;

  loadPenduduk(1);
}

function toggleFilterResetButton() {
  const btn = document.getElementById("filterResetBtn");
  if (!btn) return;
  const active = Boolean(currentSearch || currentDusun || currentJK);
  btn.hidden = !active;
}

function changePage(step) {
  const nextPage = currentPage + step;
  if (nextPage < 1 || nextPage > totalPage) return;
  loadPenduduk(nextPage);
}

function setPaginationInfo(page, total) {
  const info = document.getElementById("pageInfo");
  if (info) {
    info.textContent = `Halaman ${page} dari ${total}`;
  }
}

function updatePaginationButtons() {
  const prev = document.getElementById("prevPage");
  const next = document.getElementById("nextPage");

  if (prev) prev.disabled = currentPage <= 1;
  if (next) next.disabled = currentPage >= totalPage;
}

function populateDusunFilter() {
  fetch(`${API_URL}/penduduk/dusun/list`)
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById("filterDusun");
      if (!select || !Array.isArray(data)) return;

      const currentValue = select.value;
      select.innerHTML = `<option value="">Semua Dusun</option>`;
      data.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
      });
      select.value = currentValue;
    })
    .catch(error => {
      console.error("Load dusun error:", error);
    });
}

/* ================= FORM MODAL ================= */
function openAddModal() {
  const form = document.getElementById("formPenduduk");
  if (form) form.reset();

  document.getElementById("modalTitle").textContent = "Tambah Data Penduduk";
  document.getElementById("editId").value = "";
  document.getElementById("kewarganegaraan").value = "WNI";
  clearNikHint();

  openModal("modalForm");
}

function editPenduduk(id) {
  fetch(`${API_URL}/penduduk/${id}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("modalTitle").textContent = "Edit Data Penduduk";
      document.getElementById("editId").value = data.id || "";
      document.getElementById("dusun").value = data.dusun || "";
      document.getElementById("rw").value = data.rw || "";
      document.getElementById("rt").value = data.rt || "";
      document.getElementById("kode_keluarga").value = data.kode_keluarga || "";
      document.getElementById("nik").value = data.nik || "";
      document.getElementById("nama").value = data.nama || "";
      document.getElementById("jenis_kelamin").value = data.jenis_kelamin || "";
      document.getElementById("tempat_lahir").value = data.tempat_lahir || "";
      document.getElementById("tanggal_lahir").value = normalizeDateInput(data.tanggal_lahir);
      document.getElementById("usia").value = data.usia || "";
      document.getElementById("hubungan").value = data.hubungan || "";
      document.getElementById("status").value = data.status || "";
      document.getElementById("agama").value = data.agama || "";
      document.getElementById("gol_darah").value = data.gol_darah || "";
      document.getElementById("kewarganegaraan").value = data.kewarganegaraan || "";
      document.getElementById("etnis").value = data.etnis || "";
      document.getElementById("pendidikan").value = data.pendidikan || "";
      document.getElementById("pekerjaan").value = data.pekerjaan || "";
      document.getElementById("alamat").value = data.alamat || "";
      clearNikHint();

      openModal("modalForm");
    })
    .catch(error => {
      console.error("Edit error:", error);
      showToast("Gagal memuat data penduduk.", "error");
    });
}

function validateNik() {
  const nik = document.getElementById("nik");
  const hint = document.getElementById("nikHint");
  if (!nik || !hint) return;

  nik.value = nik.value.replace(/[^0-9]/g, "");

  if (nik.value.length > 0 && nik.value.length !== 16) {
    hint.textContent = `${nik.value.length}/16 digit — NIK biasanya 16 digit`;
    hint.classList.add("is-error");
  } else {
    clearNikHint();
  }
}

function clearNikHint() {
  const hint = document.getElementById("nikHint");
  if (!hint) return;
  hint.textContent = "16 digit angka";
  hint.classList.remove("is-error");
}

function computeAge() {
  const tanggal = document.getElementById("tanggal_lahir");
  const usia = document.getElementById("usia");
  if (!tanggal || !usia || !tanggal.value) return;

  const birth = new Date(tanggal.value);
  if (isNaN(birth.getTime())) return;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  usia.value = age >= 0 ? age : "";
}

function savePenduduk() {
  const id = document.getElementById("editId").value;
  const nama = document.getElementById("nama").value.trim();

  if (!nama) {
    showToast("Nama wajib diisi sebelum menyimpan.", "error");
    document.getElementById("nama").focus();
    return;
  }

  const payload = {
    dusun: document.getElementById("dusun").value,
    rw: document.getElementById("rw").value,
    rt: document.getElementById("rt").value,
    kode_keluarga: document.getElementById("kode_keluarga").value,
    nik: document.getElementById("nik").value,
    nama: nama,
    jenis_kelamin: document.getElementById("jenis_kelamin").value,
    tempat_lahir: document.getElementById("tempat_lahir").value,
    tanggal_lahir: document.getElementById("tanggal_lahir").value,
    usia: document.getElementById("usia").value,
    hubungan: document.getElementById("hubungan").value,
    status: document.getElementById("status").value,
    agama: document.getElementById("agama").value,
    gol_darah: document.getElementById("gol_darah").value,
    kewarganegaraan: document.getElementById("kewarganegaraan").value,
    etnis: document.getElementById("etnis").value,
    pendidikan: document.getElementById("pendidikan").value,
    pekerjaan: document.getElementById("pekerjaan").value,
    alamat: document.getElementById("alamat").value
  };

  const method = id ? "PUT" : "POST";
  const url = id ? `${API_URL}/penduduk/${id}` : `${API_URL}/penduduk`;

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        showToast(id ? "Data berhasil diperbarui." : "Data baru berhasil disimpan.", "success");
        closeModal("modalForm");
        loadPenduduk(currentPage);
        loadDashboardStats();
        populateDusunFilter();
      } else {
        showToast(result.message || "Gagal menyimpan data.", "error");
      }
    })
    .catch(error => {
      console.error("Save error:", error);
      showToast("Terjadi kesalahan saat menyimpan data.", "error");
    });
}

function deletePenduduk(id, nama) {
  showConfirm({
    title: "Hapus data ini?",
    message: nama ? `Data "${nama}" akan dihapus secara permanen.` : "Data ini akan dihapus secara permanen.",
    confirmLabel: "Ya, Hapus",
    danger: true,
    onConfirm: () => {
      fetch(`${API_URL}/penduduk/${id}`, { method: "DELETE" })
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            showToast("Data berhasil dihapus.", "success");
            loadPenduduk(currentPage);
            loadDashboardStats();
            populateDusunFilter();
          } else {
            showToast(result.message || "Gagal menghapus data.", "error");
          }
        })
        .catch(error => {
          console.error("Delete error:", error);
          showToast("Terjadi kesalahan saat menghapus data.", "error");
        });
    }
  });
}

function exportExcel() {
  window.open(`${API_URL}/penduduk/export/excel`, "_blank");
}

/* ================= DUPLICATE MODAL ================= */
function openDuplicateModal() {
  openModal("duplicateModal");
  const content = document.getElementById("duplicateContent");
  if (content) {
    content.innerHTML = `<p class="table-state">Memuat data duplikat...</p>`;
  }

  fetch(`${API_URL}/penduduk/duplicates`)
    .then(res => res.json())
    .then(data => renderDuplicates(data))
    .catch(error => {
      console.error("Duplicate error:", error);
      if (content) {
        content.innerHTML = `<p class="table-state">Gagal memuat data duplikat.</p>`;
      }
    });
}

function renderDuplicates(data) {
  const content = document.getElementById("duplicateContent");
  if (!content) return;

  if (!data || !Array.isArray(data.duplicates) || data.duplicates.length === 0) {
    content.innerHTML = `<p class="table-state">Tidak ditemukan data duplikat. Data Anda bersih ✓</p>`;
    return;
  }

  let html = `<div class="warning-text">Ditemukan ${data.count} NIK yang duplikat.</div>`;

  data.duplicates.forEach(item => {
    html += `
      <div class="duplicate-item">
        <div class="dup-header">
          <strong>NIK: ${escapeHtml(item.nik)}</strong>
          <span class="badge-danger">${item.total} data</span>
        </div>
        <div class="dup-details">
    `;

    item.records.forEach(record => {
      html += `
        <div class="dup-row">
          <span>${escapeHtml(record.nama) || "-"}</span>
          <span>${escapeHtml(record.dusun) || "-"} | ${escapeHtml(record.alamat) || "-"}</span>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  content.innerHTML = html;
}

/* ================= MODAL HELPERS ================= */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");

  const firstField = modal.querySelector("input, select, textarea, button");
  if (firstField) setTimeout(() => firstField.focus(), 50);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function initModalDismiss() {
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.is-open").forEach(modal => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
      });
    }
  });

  window.addEventListener("click", function (e) {
    document.querySelectorAll(".modal.is-open").forEach(modal => {
      if (e.target === modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
      }
    });
  });
}

/* ================= CONFIRM MODAL (pengganti window.confirm) ================= */
function showConfirm({ title, message, confirmLabel, cancelLabel, danger, onConfirm }) {
  const modal = document.getElementById("confirmModal");
  if (!modal) {
    if (window.confirm(message)) onConfirm && onConfirm();
    return;
  }

  document.getElementById("confirmTitle").textContent = title || "Konfirmasi";
  document.getElementById("confirmMessage").textContent = message || "Apakah Anda yakin?";

  const okBtn = document.getElementById("confirmOkBtn");
  const cancelBtn = document.getElementById("confirmCancelBtn");

  okBtn.textContent = confirmLabel || "Ya, Lanjutkan";
  cancelBtn.textContent = cancelLabel || "Batal";
  okBtn.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;

  const newOk = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newOk.addEventListener("click", () => {
    closeModal("confirmModal");
    onConfirm && onConfirm();
  });
  newCancel.addEventListener("click", () => closeModal("confirmModal"));

  openModal("confirmModal");
}

/* ================= TOAST (pengganti window.alert) ================= */
function showToast(message, type) {
  const stack = document.getElementById("toastStack");
  if (!stack) {
    window.alert(message);
    return;
  }

  const kind = type || "info";
  const icons = {
    success: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M5 13l4 4 10-10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 8h.01M12 11v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>'
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${kind}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[kind] || icons.info}</span>
    <span class="toast-body">${escapeHtml(message)}</span>
    <button type="button" class="toast-close" aria-label="Tutup notifikasi">&times;</button>
  `;

  stack.appendChild(toast);

  const remove = () => {
    toast.classList.add("toast-leave");
    setTimeout(() => toast.remove(), 250);
  };

  toast.querySelector(".toast-close").addEventListener("click", remove);
  setTimeout(remove, 4200);
}

/* ================= MISC ================= */
function normalizeDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function logout() {
  showConfirm({
    title: "Logout dari sistem?",
    message: "Anda akan diarahkan kembali ke halaman login.",
    confirmLabel: "Ya, Logout",
    danger: true,
    onConfirm: () => {
      try {
        localStorage.removeItem("isAdmin");
        localStorage.removeItem("userLogin");
      } catch (error) {
        console.error("Storage error:", error);
      }
      window.location.href = "login.html";
    }
  });
}