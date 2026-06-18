const express = require("express");
const router = express.Router();
const db = require("../config/database");

/* ===============================
   UTILITY FUNCTIONS
================================ */
function bulanRomawi(b) {
  const map = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return map[b - 1] || "I";
}

/* =====================================================
   GET STATISTICS
   Untuk dashboard stats cards
===================================================== */
router.get("/stats", async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const bulanIni = new Date().getMonth() + 1;

    const totalQuery = `SELECT COUNT(*)::int as count FROM register_surat WHERE tahun = $1`;
    const bulanIniQuery = `
      SELECT COUNT(*)::int as count
      FROM register_surat
      WHERE tahun = $1 AND EXTRACT(MONTH FROM tanggal_surat) = $2
    `;
    const nomorTerakhirQuery = `
      SELECT nomor_surat
      FROM register_surat
      WHERE tahun = $1
      ORDER BY nomor_urut DESC
      LIMIT 1
    `;

    const [totalResult, bulanResult, nomorResult] = await Promise.all([
      db.query(totalQuery, [tahun]),
      db.query(bulanIniQuery, [tahun, bulanIni]),
      db.query(nomorTerakhirQuery, [tahun]),
    ]);

    res.json({
      total: totalResult.rows[0]?.count || 0,
      bulanIni: bulanResult.rows[0]?.count || 0,
      nomorTerakhir: nomorResult.rows[0]?.nomor_surat || "-",
    });
  } catch (err) {
    console.error("Error getting stats:", err);
    return res.status(500).json({ message: "Gagal mengambil statistik" });
  }
});

/* =====================================================
   GET NEXT NUMBER
   Untuk preview nomor surat
===================================================== */
router.get("/next-number", async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

    const result = await db.query(
      "SELECT COALESCE(MAX(nomor_urut), 0)::int AS max FROM register_surat WHERE tahun = $1",
      [tahun]
    );

    const nextNumber = (result.rows[0]?.max || 0) + 1;
    res.json({ nextNumber });
  } catch (err) {
    console.error("Error getting next number:", err);
    return res.status(500).json({ message: "Gagal mengambil nomor" });
  }
});

/* =====================================================
   POST: TAMBAH REGISTER
   - Nomor otomatis
   - Reset per tahun
   - Return nomor surat
===================================================== */
router.post("/", async (req, res) => {
  const client = await db.connect();

  try {
    const { jenis, tanggal, perihal, bersangkutan } = req.body;

    if (!jenis || !tanggal || !perihal || !bersangkutan) {
      client.release();
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    const tahun = new Date(tanggal).getFullYear();
    const bulan = new Date(tanggal).getMonth() + 1;

    console.log("📝 Creating new register:", { jenis, tanggal, perihal, bersangkutan });

    await client.query("BEGIN");

    const maxResult = await client.query(
      "SELECT COALESCE(MAX(nomor_urut), 0)::int AS max FROM register_surat WHERE tahun = $1",
      [tahun]
    );

    const next = (maxResult.rows[0]?.max || 0) + 1;
    const nomorUrut = String(next).padStart(3, "0");
    const romawi = bulanRomawi(bulan);
    const nomorSurat = `${nomorUrut}/${jenis}/2006/${romawi}/${tahun}`;

    const insertQuery = `
      INSERT INTO register_surat (
        nomor_urut,
        jenis_surat,
        kode_desa,
        bulan_romawi,
        tahun,
        nomor_surat,
        tanggal_surat,
        perihal,
        bersangkutan
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const insertResult = await client.query(insertQuery, [
      next,
      jenis,
      "2006",
      romawi,
      tahun,
      nomorSurat,
      tanggal,
      perihal,
      bersangkutan,
    ]);

    await client.query("COMMIT");
    client.release();

    console.log("✅ Register created successfully:", nomorSurat);

    res.json({
      success: true,
      message: "Register berhasil disimpan",
      nomorSurat,
      id: insertResult.rows[0].id,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    console.error("Error inserting register:", err);
    return res.status(500).json({ message: "Gagal menyimpan register" });
  }
});

/* =====================================================
   GET: LIST REGISTER
   - Search
   - Pagination
   - Filter by tahun
   - Sorted by terbaru (DESC)
===================================================== */
router.get("/", async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun);
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    if (!tahun) {
      return res.status(400).json({ message: "Parameter tahun wajib" });
    }

    const searchPattern = `%${search}%`;
    const params = [tahun, searchPattern, searchPattern, searchPattern];

    const whereClause = `
      WHERE tahun = $1
        AND (
          nomor_surat ILIKE $2
          OR perihal ILIKE $3
          OR bersangkutan ILIKE $4
        )
    `;

    const countQuery = `SELECT COUNT(*)::int AS total FROM register_surat ${whereClause}`;
    const countResult = await db.query(countQuery, params);

    const total = countResult.rows[0]?.total || 0;
    const totalPage = Math.ceil(total / limit);

    const dataQuery = `
      SELECT * FROM register_surat
      ${whereClause}
      ORDER BY created_at DESC, nomor_urut DESC
      LIMIT $5 OFFSET $6
    `;

    const dataResult = await db.query(dataQuery, [...params, limit, offset]);

    console.log(`📋 Fetched ${dataResult.rows.length} registers (page ${page}/${totalPage})`);

    res.json({
      success: true,
      data: dataResult.rows,
      page,
      limit,
      total,
      totalPage,
    });
  } catch (err) {
    console.error("Error fetching register:", err);
    return res.status(500).json({ message: "Gagal mengambil data" });
  }
});

/* =====================================================
   GET: SINGLE REGISTER BY ID
===================================================== */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID harus berupa angka" });
    }

    const result = await db.query("SELECT * FROM register_surat WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Register tidak ditemukan" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error fetching single register:", err);
    return res.status(500).json({ message: "Gagal mengambil data" });
  }
});

/* =====================================================
   PUT: EDIT REGISTER
   - HANYA bisa edit perihal & bersangkutan
   - TIDAK bisa edit nomor surat
===================================================== */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { perihal, bersangkutan } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID harus berupa angka" });
    }

    if (!perihal || !bersangkutan) {
      return res.status(400).json({ message: "Perihal dan bersangkutan wajib diisi" });
    }

    console.log(`✏️ Updating register ID ${id}`);

    const result = await db.query(
      `UPDATE register_surat
       SET perihal = $1, bersangkutan = $2, updated_at = NOW()
       WHERE id = $3`,
      [perihal, bersangkutan, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Register tidak ditemukan" });
    }

    console.log(`✅ Register ID ${id} updated successfully`);

    res.json({
      success: true,
      message: "Data berhasil diperbarui",
    });
  } catch (err) {
    console.error("Error updating register:", err);
    return res.status(500).json({ message: "Gagal memperbarui data" });
  }
});

/* =====================================================
   DELETE: HAPUS REGISTER
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID harus berupa angka" });
    }

    console.log(`🗑️ Deleting register ID ${id}`);

    const result = await db.query("DELETE FROM register_surat WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Register tidak ditemukan" });
    }

    console.log(`✅ Register ID ${id} deleted successfully`);

    res.json({
      success: true,
      message: "Data berhasil dihapus",
    });
  } catch (err) {
    console.error("Error deleting register:", err);
    return res.status(500).json({ message: "Gagal menghapus data" });
  }
});

module.exports = router;