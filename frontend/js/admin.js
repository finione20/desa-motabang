let importedData = [];
let currentPage = 1;
let currentSearch = "";
let currentDusun = "";
let currentJK = "";
let totalPage = 1;
let totalData = 0;

const LIMIT = 10;
const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api";

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardStats();
  populateDusunFilter();
});

function showPage(id, el) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  const targetPage = document.getElementById(id);
  if (targetPage) targetPage.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  if (el) el.classList.add("active");

  if (id === "dashboard") {
    loadDashboardStats();
  }

  if (id === "penduduk") {
    loadPenduduk(1);
  }
}

function loadDashboardStats() {
  fetch(`${API_URL}/penduduk/stats`)
    .then(res => {
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    })
    .then(data => {
      setText("totalPenduduk", data.total || 0);
      setText("totalLaki", data.laki || 0);
      setText("totalPerempuan", data.perempuan || 0);
      setText("totalKeluarga", data.keluarga || 0);
    })
    .catch(error => {
      console.error("Error loading stats:", error);
      setText("totalPenduduk", 0);
      setText("totalLaki", 0);
      setText("totalPerempuan", 0);
      setText("totalKeluarga", 0);
    });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = Number(value).toLocaleString("id-ID");
}

function importExcel() {
  const fileInput = document.getElementById("fileExcel");
  const file = fileInput ? fileInput.files[0] : null;

  if (!file) {
    alert("Pilih file Excel terlebih dahulu.");
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
      alert(`Preview berhasil dimuat (${importedData.length} baris).`);
    } catch (error) {
      console.error(error);
      alert("Gagal membaca file Excel. Pastikan format file benar.");
    }
  };

  reader.readAsArrayBuffer(file);
}

function renderPreviewTable(data) {
  const tbody = document.querySelector("#tabelPenduduk tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-state">Tidak ada data preview.</td></tr>`;
    return;
  }

  data.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.dusun || "-"}</td>
      <td>${item.rw || "-"}/${item.rt || "-"}</td>
      <td>${item.kode_keluarga || "-"}</td>
      <td>${item.nik || "-"}</td>
      <td>${item.nama || "-"}</td>
      <td>${item.jenis_kelamin || "-"}</td>
      <td>${formatTTL(item.tempat_lahir, item.tanggal_lahir)}</td>
      <td>${item.usia || "-"}</td>
      <td>${item.alamat || "-"}</td>
      <td><span class="badge-danger">Preview</span></td>
    `;
    tbody.appendChild(tr);
  });

  setPaginationInfo(1, 1);
}

function saveToDatabase() {
  if (!Array.isArray(importedData) || importedData.length === 0) {
    alert("Belum ada data preview untuk disimpan.");
    return;
  }

  fetch(`${API_URL}/penduduk/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: importedData })
  })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        alert("Data berhasil disimpan ke database.");
        importedData = [];
        loadDashboardStats();
        loadPenduduk(1);
        populateDusunFilter();
      } else {
        alert(result.message || "Gagal menyimpan data.");
      }
    })
    .catch(error => {
      console.error("Save error:", error);
      alert("Terjadi kesalahan saat menyimpan data.");
    });
}

function loadPenduduk(page = 1) {
  currentPage = page;
  const tbody = document.querySelector("#tabelPenduduk tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-state">Memuat data...</td></tr>`;
  }

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
    })
    .catch(error => {
      console.error("Load penduduk error:", error);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="11" class="table-state">Gagal memuat data.</td></tr>`;
      }
    });
}

function renderPendudukTable(data) {
  const tbody = document.querySelector("#tabelPenduduk tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-state">Tidak ada data ditemukan.</td></tr>`;
    return;
  }

  data.forEach((item, index) => {
    const rowNumber = (currentPage - 1) * LIMIT + index + 1;
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${rowNumber}</td>
      <td>${item.dusun || "-"}</td>
      <td>${item.rw || "-"}/${item.rt || "-"}</td>
      <td>${item.kode_keluarga || "-"}</td>
      <td>${item.nik || "-"}</td>
      <td>${item.nama || "-"}</td>
      <td>${item.jenis_kelamin || "-"}</td>
      <td>${formatTTL(item.tempat_lahir, item.tanggal_lahir)}</td>
      <td>${item.usia || "-"}</td>
      <td>${item.alamat || "-"}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-edit" type="button" onclick="editPenduduk('${item.id}')">✎</button>
          <button class="btn-delete" type="button" onclick="deletePenduduk('${item.id}')">×</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function formatTTL(tempat, tanggal) {
  if (!tempat && !tanggal) return "-";
  if (!tanggal) return tempat || "-";

  const date = new Date(tanggal);
  const formatted = isNaN(date.getTime())
    ? tanggal
    : date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

  return `${tempat || "-"}, ${formatted}`;
}

function handleSearch() {
  const input = document.getElementById("searchInput");
  currentSearch = input ? input.value.trim() : "";
  loadPenduduk(1);
}

function handleFilter() {
  const dusun = document.getElementById("filterDusun");
  const jk = document.getElementById("filterJK");

  currentDusun = dusun ? dusun.value : "";
  currentJK = jk ? jk.value : "";
  loadPenduduk(1);
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

      select.innerHTML = `<option value="">Semua Dusun</option>`;
      data.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
      });
    })
    .catch(error => {
      console.error("Load dusun error:", error);
    });
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

      openModal("modalForm");
    })
    .catch(error => {
      console.error("Edit error:", error);
      alert("Gagal memuat data penduduk.");
    });
}

function savePenduduk() {
  const id = document.getElementById("editId").value;

  const payload = {
    dusun: document.getElementById("dusun").value,
    rw: document.getElementById("rw").value,
    rt: document.getElementById("rt").value,
    kode_keluarga: document.getElementById("kode_keluarga").value,
    nik: document.getElementById("nik").value,
    nama: document.getElementById("nama").value,
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
        alert("Data berhasil disimpan.");
        closeModal("modalForm");
        loadPenduduk(currentPage);
        loadDashboardStats();
        populateDusunFilter();
      } else {
        alert(result.message || "Gagal menyimpan data.");
      }
    })
    .catch(error => {
      console.error("Save error:", error);
      alert("Terjadi kesalahan saat menyimpan data.");
    });
}

function deletePenduduk(id) {
  if (!confirm("Hapus data ini?")) return;

  fetch(`${API_URL}/penduduk/${id}`, { method: "DELETE" })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        alert("Data berhasil dihapus.");
        loadPenduduk(currentPage);
        loadDashboardStats();
        populateDusunFilter();
      } else {
        alert(result.message || "Gagal menghapus data.");
      }
    })
    .catch(error => {
      console.error("Delete error:", error);
      alert("Terjadi kesalahan saat menghapus data.");
    });
}

function exportExcel() {
  window.open(`${API_URL}/penduduk/export/excel`, "_blank");
}

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
    content.innerHTML = `<p class="table-state">Tidak ditemukan data duplikat.</p>`;
    return;
  }

  let html = `<div class="warning-text">Ditemukan ${data.count} NIK yang duplikat.</div>`;

  data.duplicates.forEach(item => {
    html += `
      <div class="duplicate-item">
        <div class="dup-header">
          <strong>NIK: ${item.nik}</strong>
          <span class="badge-danger">${item.total} data</span>
        </div>
        <div class="dup-details">
    `;

    item.records.forEach(record => {
      html += `
        <div class="dup-row">
          <span>${record.nama || "-"}</span>
          <span>${record.dusun || "-"} | ${record.alamat || "-"}</span>
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

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "block";
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}

function normalizeDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function logout() {
  if (confirm("Logout dari sistem admin?")) {
    try {
      localStorage.removeItem("isAdmin");
      localStorage.removeItem("userLogin");
    } catch (error) {
      console.error("Storage error:", error);
    }

    window.location.href = "login.html";
  }
}

window.addEventListener("click", function (e) {
  document.querySelectorAll(".modal").forEach(modal => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
});