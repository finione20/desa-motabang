const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api";
const KODE_DESA = "2006";
let currentPage = 1;
let totalPages = 1;
const LIMIT = 10;
let searchTimeout;
let currentEditId = null;

document.addEventListener("DOMContentLoaded", function () {
  initializeForm();
  populateTahunFilter();
  loadStatistics();
  loadRegister(1);
  setupPreviewUpdate();
});

function initializeForm() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("tanggalSurat").value = today;
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
  try {
    const tahun = document.getElementById("filterTahun").value || new Date().getFullYear();
    const res = await fetch(`${API_URL}/register-surat/stats?tahun=${tahun}`);
    const data = await res.json();

    document.getElementById("totalSurat").textContent = data.total || 0;
    document.getElementById("bulanIni").textContent = data.bulanIni || 0;
    document.getElementById("nomorTerakhir").textContent = data.nomorTerakhir || "-";
  } catch (error) {
    console.error("Error loading statistics:", error);
  }
}

function setupPreviewUpdate() {
  const jenisSurat = document.getElementById("jenisSurat");
  const tanggalSurat = document.getElementById("tanggalSurat");

  jenisSurat.addEventListener("change", updatePreview);
  tanggalSurat.addEventListener("change", updatePreview);
}

async function updatePreview() {
  const jenis = document.getElementById("jenisSurat").value;
  const tanggal = document.getElementById("tanggalSurat").value;
  const previewElement = document.getElementById("previewNomor");

  if (!jenis || !tanggal) {
    previewElement.textContent = "Pilih jenis surat dan tanggal untuk melihat preview";
    return;
  }

  try {
    const tahun = new Date(tanggal).getFullYear();
    const bulan = new Date(tanggal).getMonth() + 1;
    const res = await fetch(`${API_URL}/register-surat/next-number?tahun=${tahun}`);
    const data = await res.json();

    const nomorUrut = String(data.nextNumber).padStart(3, "0");
    const romawi = bulanRomawi(bulan);
    previewElement.textContent = `${nomorUrut}/${jenis}/${KODE_DESA}/${romawi}/${tahun}`;
  } catch (error) {
    console.error("Error updating preview:", error);
    previewElement.textContent = "Gagal memuat preview nomor surat";
  }
}

function bulanRomawi(bulan) {
  const map = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return map[bulan - 1] || "I";
}

async function simpanRegister(event) {
  if (event) event.preventDefault();

  const jenis = document.getElementById("jenisSurat").value.trim();
  const tanggal = document.getElementById("tanggalSurat").value;
  const perihal = document.getElementById("perihal").value.trim();
  const bersangkutan = document.getElementById("bersangkutan").value.trim();

  if (!jenis || !tanggal || !perihal || !bersangkutan) {
    showNotification("Semua field wajib diisi.", "error");
    return;
  }

  const btnSimpan = document.getElementById("btnSimpan");
  btnSimpan.disabled = true;
  btnSimpan.textContent = "Menyimpan...";

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
    btnSimpan.textContent = "Simpan Register";
  }
}

function resetForm() {
  document.getElementById("formRegister").reset();
  document.getElementById("tanggalSurat").value = new Date().toISOString().split("T")[0];
  document.getElementById("previewNomor").textContent = "Pilih jenis surat dan tanggal untuk melihat preview";
}

async function loadRegister(page = 1) {
  currentPage = page;

  const tahun = document.getElementById("filterTahun").value || new Date().getFullYear();
  const search = document.getElementById("searchSurat")?.value || "";
  const tbody = document.getElementById("tabelRegister");

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="table-state">Memuat data...</td>
    </tr>
  `;

  try {
    const res = await fetch(
      `${API_URL}/register-surat?tahun=${encodeURIComponent(tahun)}&search=${encodeURIComponent(search)}&page=${page}&limit=${LIMIT}`
    );

    const data = await res.json();
    totalPages = data.totalPages || 1;

    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="table-state">Belum ada data register surat.</td>
        </tr>
      `;
      updatePagination();
      return;
    }

    tbody.innerHTML = data.data.map((item, index) => `
      <tr>
        <td>${(currentPage - 1) * LIMIT + index + 1}</td>
        <td>${item.nomor_surat || "-"}</td>
        <td>${formatDate(item.tanggal_surat)}</td>
        <td>${item.jenis_surat || "-"}</td>
        <td>${item.perihal || "-"}</td>
        <td>${item.bersangkutan || "-"}</td>
        <td>
          <button class="btn-edit" type="button" onclick="editRegister(${item.id})">Edit</button>
          <button class="btn-delete" type="button" onclick="hapusRegister(${item.id})">Hapus</button>
        </td>
      </tr>
    `).join("");

    updatePagination();
  } catch (error) {
    console.error("Error loading register:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="table-state">Gagal memuat data register.</td>
      </tr>
    `;
  }
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
  }
}

async function hapusRegister(id) {
  const confirmDelete = confirm("Yakin ingin menghapus register surat ini?");
  if (!confirmDelete) return;

  try {
    const res = await fetch(`${API_URL}/register-surat/${id}`, {
      method: "DELETE"
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || "Gagal menghapus data");
    }

    loadRegister(currentPage);
    loadStatistics();
    showNotification("Data register berhasil dihapus.", "success");
  } catch (error) {
    console.error("Delete error:", error);
    showNotification(error.message || "Terjadi kesalahan saat menghapus data.", "error");
  }
}

function openModal() {
  document.getElementById("editModal").style.display = "block";
}

function closeModal() {
  document.getElementById("editModal").style.display = "none";
  currentEditId = null;
}

function normalizeDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");
  const messageBox = document.getElementById("notificationMessage");

  notification.className = `notification show ${type}`;
  messageBox.textContent = message;

  clearTimeout(notification._timeout);
  notification._timeout = setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
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