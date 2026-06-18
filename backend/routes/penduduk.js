const express = require("express");
const router = express.Router();
const db = require("../config/database");

const allowedColumns = [
  "rw",
  "rt",
  "dusun",
  "alamat",
  "kode_keluarga",
  "nik",
  "nama",
  "jenis_kelamin",
  "hubungan",
  "tempat_lahir",
  "tanggal_lahir",
  "usia",
  "status",
  "agama",
  "gol_darah",
  "kewarganegaraan",
  "etnis",
  "pendidikan",
  "pekerjaan",
  "updated_at",
];

const IMPORT_BATCH_SIZE = 100;

function normalizeEmpty(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned === "" ? null : cleaned;
  }
  return value;
}

function normalizeDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return trimmed;

    const indoMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (indoMatch) {
      const day = indoMatch[1].padStart(2, "0");
      const month = indoMatch[2].padStart(2, "0");
      const year = indoMatch[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  return null;
}

function normalizeUsia(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function normalizeGolDarah(value) {
  if (!value) return null;

  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;

  const cleaned = raw.replace(/\s+/g, "");

  const exactMap = {
    A: "A",
    B: "B",
    AB: "AB",
    O: "O",
    "A+": "A+",
    "A-": "A-",
    "B+": "B+",
    "B-": "B-",
    "AB+": "AB+",
    "AB-": "AB-",
    "O+": "O+",
    "O-": "O-",
  };

  if (exactMap[cleaned]) return exactMap[cleaned];

  if (cleaned.includes("AB")) return "AB";
  if (cleaned.includes("A")) return "A";
  if (cleaned.includes("B")) return "B";
  if (cleaned.includes("O") || cleaned.includes("0")) return "O";

  return null;
}

function normalizeJenisKelamin(value) {
  if (!value) return null;

  const raw = String(value).trim().toLowerCase().replace(/\s+/g, " ");

  if (["l", "lk", "laki", "laki-laki", "laki laki", "pria"].includes(raw)) {
    return "Laki-laki";
  }

  if (["p", "pr", "perempuan", "wanita"].includes(raw)) {
    return "Perempuan";
  }

  return normalizeEmpty(value);
}

function normalizePendudukRow(d) {
  return {
    rw: normalizeEmpty(d.rw),
    rt: normalizeEmpty(d.rt),
    dusun: normalizeEmpty(d.dusun),
    alamat: normalizeEmpty(d.alamat),
    kode_keluarga: normalizeEmpty(d.kode_keluarga),
    nik: String(d.nik).trim(),
    nama: normalizeEmpty(d.nama),
    jenis_kelamin: normalizeJenisKelamin(d.jenis_kelamin),
    hubungan: normalizeEmpty(d.hubungan),
    tempat_lahir: normalizeEmpty(d.tempat_lahir),
    tanggal_lahir: normalizeDate(d.tanggal_lahir),
    usia: normalizeUsia(d.usia),
    status: normalizeEmpty(d.status),
    agama: normalizeEmpty(d.agama),
    gol_darah: normalizeGolDarah(d.gol_darah),
    kewarganegaraan: normalizeEmpty(d.kewarganegaraan || "WNI"),
    etnis: normalizeEmpty(d.etnis),
    pendidikan: normalizeEmpty(d.pendidikan),
    pekerjaan: normalizeEmpty(d.pekerjaan),
  };
}

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function deduplicateByNik(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.nik) continue;
    map.set(row.nik, row);
  }

  return Array.from(map.values());
}

function rowToValues(row) {
  return [
    row.rw,
    row.rt,
    row.dusun,
    row.alamat,
    row.kode_keluarga,
    row.nik,
    row.nama,
    row.jenis_kelamin,
    row.hubungan,
    row.tempat_lahir,
    row.tanggal_lahir,
    row.usia,
    row.status,
    row.agama,
    row.gol_darah,
    row.kewarganegaraan,
    row.etnis,
    row.pendidikan,
    row.pekerjaan,
  ];
}

async function safeQuery(sql, params = [], retry = 1) {
  try {
    return await db.query(sql, params);
  } catch (err) {
    if (retry > 0 && (err.code === "ECONNRESET" || err.code === "57P01")) {
      console.warn("⚠️ Query retry karena koneksi terputus...");
      return await db.query(sql, params);
    }
    throw err;
  }
}

async function upsertPendudukBatch(client, rows) {
  if (!rows.length) return 0;

  const values = [];
  const valuePlaceholders = [];
  const columnCount = 19;

  rows.forEach((row, rowIndex) => {
    const rowValues = rowToValues(row);
    const offset = rowIndex * columnCount;
    const placeholders = Array.from(
      { length: columnCount },
      (_, colIndex) => `$${offset + colIndex + 1}`
    );
    valuePlaceholders.push(`(${placeholders.join(", ")})`);
    values.push(...rowValues);
  });

  const sql = `
    INSERT INTO penduduk (
      rw, rt, dusun, alamat, kode_keluarga, nik, nama, jenis_kelamin, hubungan,
      tempat_lahir, tanggal_lahir, usia, status, agama, gol_darah,
      kewarganegaraan, etnis, pendidikan, pekerjaan
    ) VALUES
      ${valuePlaceholders.join(", ")}
    ON CONFLICT (nik) DO UPDATE SET
      rw = EXCLUDED.rw,
      rt = EXCLUDED.rt,
      dusun = EXCLUDED.dusun,
      alamat = EXCLUDED.alamat,
      kode_keluarga = EXCLUDED.kode_keluarga,
      nama = EXCLUDED.nama,
      jenis_kelamin = EXCLUDED.jenis_kelamin,
      hubungan = EXCLUDED.hubungan,
      tempat_lahir = EXCLUDED.tempat_lahir,
      tanggal_lahir = EXCLUDED.tanggal_lahir,
      usia = EXCLUDED.usia,
      status = EXCLUDED.status,
      agama = EXCLUDED.agama,
      gol_darah = EXCLUDED.gol_darah,
      kewarganegaraan = EXCLUDED.kewarganegaraan,
      etnis = EXCLUDED.etnis,
      pendidikan = EXCLUDED.pendidikan,
      pekerjaan = EXCLUDED.pekerjaan,
      updated_at = NOW()
  `;

  await client.query(sql, values);
  return rows.length;
}

/* =====================================================
   IMPORT EXCEL → UPSERT (BATCH INSERT / UPDATE)
===================================================== */
router.post("/import", async (req, res) => {
  const client = await db.connect();

  try {
    const data = req.body?.data;

    console.log("📥 Import request body keys:", Object.keys(req.body || {}));
    console.log("📥 Import request received, data count:", data?.length || 0);

    if (!Array.isArray(data) || data.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: "Data kosong",
      });
    }

    const validData = data.filter((d) => d && d.nik && String(d.nik).trim() !== "");

    if (validData.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: "Tidak ada data valid (NIK kosong)",
      });
    }

    console.log("✅ Valid data count:", validData.length);

    const normalizedRows = validData.map(normalizePendudukRow);
    const dedupedRows = deduplicateByNik(normalizedRows);

    console.log(`🧹 Setelah deduplicate NIK: ${dedupedRows.length}/${normalizedRows.length}`);

    await client.query("BEGIN");

    let insertedOrUpdated = 0;
    const batches = chunkArray(dedupedRows, IMPORT_BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await upsertPendudukBatch(client, batch);
      insertedOrUpdated += batch.length;
      console.log(`✅ Batch ${i + 1}/${batches.length}: ${insertedOrUpdated}/${dedupedRows.length}`);
    }

    await client.query("COMMIT");
    client.release();

    return res.json({
      success: true,
      message: "Import selesai (insert & update)",
      affectedRows: insertedOrUpdated,
      insertedRows: insertedOrUpdated,
      updatedRows: 0,
      totalInput: normalizedRows.length,
      totalUniqueNik: dedupedRows.length,
      skippedDuplicatesInFile: normalizedRows.length - dedupedRows.length,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("❌ Rollback error:", rollbackErr);
    }

    client.release();

    console.error("❌ Import error:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal import data",
      error: err.message,
      code: err.code,
    });
  }
});

/* =====================================================
   GET STATISTICS FOR DASHBOARD & DESA.HTML
===================================================== */
router.get("/stats", async (req, res) => {
  try {
    const sql = `
      SELECT 
        COUNT(*)::int as total,
        SUM(
          CASE 
            WHEN LOWER(TRIM(jenis_kelamin)) IN ('l', 'lk', 'laki', 'laki-laki', 'laki laki', 'pria')
            THEN 1 ELSE 0
          END
        )::int as laki,
        SUM(
          CASE 
            WHEN LOWER(TRIM(jenis_kelamin)) IN ('p', 'pr', 'perempuan', 'wanita')
            THEN 1 ELSE 0
          END
        )::int as perempuan,
        COUNT(
          DISTINCT CASE
            WHEN kode_keluarga IS NOT NULL AND TRIM(kode_keluarga) != ''
            THEN kode_keluarga
          END
        )::int as keluarga
      FROM penduduk
    `;

    const result = await safeQuery(sql);
    const row = result.rows[0] || {};

    res.json({
      total: row.total || 0,
      laki: row.laki || 0,
      perempuan: row.perempuan || 0,
      keluarga: row.keluarga || 0,
    });
  } catch (err) {
    console.error("❌ Stats error:", err);
    return res.status(500).json({ message: "Gagal mengambil statistik" });
  }
});

/* =====================================================
   LIST DUSUN
===================================================== */
router.get("/dusun/list", async (req, res) => {
  try {
    const result = await safeQuery(`
      SELECT DISTINCT dusun
      FROM penduduk
      WHERE dusun IS NOT NULL AND TRIM(dusun) != ''
      ORDER BY dusun ASC
    `);

    res.json(result.rows.map((row) => row.dusun));
  } catch (err) {
    console.error("❌ Dusun list error:", err);
    return res.status(500).json({ message: "Gagal mengambil daftar dusun" });
  }
});

/* =====================================================
   CEK DATA DUPLIKAT (BY NIK)
===================================================== */
router.get("/duplicates", async (req, res) => {
  try {
    const sql = `
      SELECT nik, COUNT(*)::int as total
      FROM penduduk
      WHERE nik IS NOT NULL AND nik != ''
      GROUP BY nik
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `;

    const duplicatesResult = await safeQuery(sql);
    const duplicates = duplicatesResult.rows;

    if (duplicates.length === 0) {
      return res.json({ count: 0, duplicates: [] });
    }

    const nikList = duplicates.map((d) => d.nik);
    const detailSql = `
      SELECT id, nik, nama, dusun, alamat, kode_keluarga
      FROM penduduk
      WHERE nik = ANY($1)
      ORDER BY nik, id
    `;

    const detailResult = await safeQuery(detailSql, [nikList]);
    const details = detailResult.rows;

    const grouped = duplicates.map((dup) => ({
      nik: dup.nik,
      total: dup.total,
      records: details.filter((d) => d.nik === dup.nik),
    }));

    res.json({
      count: duplicates.length,
      duplicates: grouped,
    });
  } catch (err) {
    console.error("❌ Duplicates check error:", err);
    return res.status(500).json({ message: "Gagal memeriksa duplikat" });
  }
});

/* =====================================================
   HAPUS DATA DUPLIKAT (KEEP FIRST, DELETE REST)
===================================================== */
router.delete("/clean/duplicates", async (req, res) => {
  try {
    const deleteSql = `
      DELETE FROM penduduk p
      USING (
        SELECT nik, MIN(id) AS keep_id
        FROM penduduk
        WHERE nik IS NOT NULL AND nik != ''
        GROUP BY nik
        HAVING COUNT(*) > 1
      ) d
      WHERE p.nik = d.nik
        AND p.id <> d.keep_id
    `;

    const result = await safeQuery(deleteSql);

    res.json({
      success: true,
      message: result.rowCount === 0 ? "Tidak ada duplikat" : "Duplikat berhasil dihapus",
      deleted: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Delete duplicate error:", err);
    return res.status(500).json({ success: false, message: "Gagal mencari atau menghapus duplikat" });
  }
});

/* =====================================================
   EXPORT ALL DATA
===================================================== */
router.get("/export/excel", async (req, res) => {
  try {
    const sql = `
      SELECT 
        dusun as "Dusun",
        rw as "RW",
        rt as "RT",
        kode_keluarga as "Kode Keluarga",
        nik as "NIK",
        nama as "Nama",
        jenis_kelamin as "Jenis Kelamin",
        hubungan as "Hubungan",
        tempat_lahir as "Tempat Lahir",
        TO_CHAR(tanggal_lahir, 'DD-MM-YYYY') as "Tanggal Lahir",
        usia as "Usia",
        status as "Status",
        agama as "Agama",
        gol_darah as "Golongan Darah",
        kewarganegaraan as "Kewarganegaraan",
        etnis as "Etnis/Suku",
        pendidikan as "Pendidikan",
        pekerjaan as "Pekerjaan",
        alamat as "Alamat"
      FROM penduduk
      ORDER BY dusun, rw, rt, kode_keluarga
    `;

    const result = await safeQuery(sql);
    console.log("✅ Export success:", result.rows.length, "rows");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Export error:", err);
    return res.status(500).json({ message: "Gagal export data" });
  }
});

/* =====================================================
   STATISTIK PENDUDUK (UNTUK WEBSITE DESA - LEGACY)
===================================================== */
router.get("/statistik/summary", async (req, res) => {
  try {
    const sql = `
      SELECT
        COUNT(*)::int AS total,
        SUM(
          CASE 
            WHEN LOWER(TRIM(jenis_kelamin)) IN ('l', 'lk', 'laki', 'laki-laki', 'laki laki', 'pria')
            THEN 1 ELSE 0
          END
        )::int AS laki,
        SUM(
          CASE 
            WHEN LOWER(TRIM(jenis_kelamin)) IN ('p', 'pr', 'perempuan', 'wanita')
            THEN 1 ELSE 0
          END
        )::int AS perempuan,
        COUNT(
          DISTINCT CASE
            WHEN kode_keluarga IS NOT NULL AND TRIM(kode_keluarga) != ''
            THEN kode_keluarga
          END
        )::int AS keluarga
      FROM penduduk
    `;

    const result = await safeQuery(sql);
    const row = result.rows[0] || {};

    res.json({
      total: row.total || 0,
      laki: row.laki || 0,
      perempuan: row.perempuan || 0,
      keluarga: row.keluarga || 0,
    });
  } catch (err) {
    console.error("❌ Statistik error:", err);
    return res.status(500).json({
      total: 0,
      laki: 0,
      perempuan: 0,
      keluarga: 0,
    });
  }
});

/* =====================================================
   GET DATA PENDUDUK (LIST)
===================================================== */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const dusun = req.query.dusun || "";
    const jk = req.query.jk || "";
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];
    let index = 1;

    if (search) {
      whereClause += ` AND (
        nama ILIKE $${index}
        OR nik ILIKE $${index + 1}
        OR alamat ILIKE $${index + 2}
        OR kode_keluarga ILIKE $${index + 3}
      )`;
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword);
      index += 4;
    }

    if (dusun) {
      whereClause += ` AND dusun = $${index}`;
      params.push(dusun);
      index += 1;
    }

    if (jk) {
      whereClause += ` AND jenis_kelamin = $${index}`;
      params.push(jk);
      index += 1;
    }

    const sqlCount = `
      SELECT COUNT(*)::int AS total
      FROM penduduk
      ${whereClause}
    `;

    const countResult = await safeQuery(sqlCount, params);
    const total = countResult.rows[0]?.total || 0;
    const totalPage = Math.ceil(total / limit);

    const sqlData = `
      SELECT *
      FROM penduduk
      ${whereClause}
      ORDER BY dusun, rw, rt, kode_keluarga
      LIMIT $${index} OFFSET $${index + 1}
    `;

    const dataResult = await safeQuery(sqlData, [...params, limit, offset]);

    res.json({
      data: dataResult.rows,
      page,
      limit,
      totalData: total,
      totalPage,
    });
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return res.status(500).json({ message: "Gagal ambil data" });
  }
});

/* =====================================================
   GET SINGLE DATA BY ID
===================================================== */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID harus berupa angka" });
    }

    const result = await safeQuery("SELECT * FROM penduduk WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Get single error:", err);
    return res.status(500).json({ message: "Gagal mengambil data" });
  }
});

/* =====================================================
   INSERT DATA BARU
===================================================== */
router.post("/", async (req, res) => {
  try {
    const d = normalizePendudukRow(req.body);

    if (!d.nik || !String(d.nik).trim()) {
      return res.status(400).json({
        success: false,
        message: "NIK wajib diisi",
      });
    }

    const sql = `
      INSERT INTO penduduk (
        rw, rt, dusun, alamat, kode_keluarga, nik, nama, jenis_kelamin, hubungan,
        tempat_lahir, tanggal_lahir, usia, status, agama, gol_darah,
        kewarganegaraan, etnis, pendidikan, pekerjaan
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19
      )
    `;

    const values = rowToValues(d);
    const result = await safeQuery(sql, values);

    res.json({
      success: true,
      message: "Data berhasil ditambahkan",
      affectedRows: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Insert error:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal menambah data",
      error: err.message,
    });
  }
});

/* =====================================================
   UPDATE DATA (EDIT)
===================================================== */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = { ...req.body };

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID harus berupa angka" });
    }

    delete data.id;
    delete data.created_at;

    data.updated_at = new Date();

    if (data.tanggal_lahir !== undefined) data.tanggal_lahir = normalizeDate(data.tanggal_lahir);
    if (data.usia !== undefined) data.usia = normalizeUsia(data.usia);
    if (data.jenis_kelamin !== undefined) data.jenis_kelamin = normalizeJenisKelamin(data.jenis_kelamin);
    if (data.gol_darah !== undefined) data.gol_darah = normalizeGolDarah(data.gol_darah);

    Object.keys(data).forEach((key) => {
      if (typeof data[key] === "string") data[key] = normalizeEmpty(data[key]);
    });

    const entries = Object.entries(data).filter(([key]) => allowedColumns.includes(key));

    if (entries.length === 0) {
      return res.status(400).json({ success: false, message: "Tidak ada data yang bisa diperbarui" });
    }

    const setClause = entries.map(([key], idx) => `${key} = $${idx + 1}`).join(", ");
    const values = entries.map(([, value]) => value);
    values.push(id);

    const sql = `UPDATE penduduk SET ${setClause} WHERE id = $${values.length}`;
    const result = await safeQuery(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    }

    console.log("✅ Update success, ID:", id);
    res.json({
      success: true,
      message: "Data berhasil diperbarui",
      affectedRows: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Update error:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui data",
      error: err.message,
    });
  }
});

/* =====================================================
   DELETE DATA (HAPUS)
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID harus berupa angka" });
    }

    const result = await safeQuery("DELETE FROM penduduk WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    }

    console.log("✅ Delete success, ID:", id);
    res.json({
      success: true,
      message: "Data berhasil dihapus",
      affectedRows: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Delete error:", err);
    return res.status(500).json({ success: false, message: "Gagal menghapus data" });
  }
});

module.exports = router;