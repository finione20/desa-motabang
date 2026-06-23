const express = require("express");
const router = express.Router();
const db = require("../config/database");

const allowedColumns = [
  "nama",
  "dusun",
  "nop",
  "jumlah",
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

function normalizeNop(value) {
  if (value === undefined || value === null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  return raw.replace(/\s+/g, "");
}

function normalizeCurrency(value) {
  if (value === undefined || value === null || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  const raw = String(value).trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/rp/gi, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "");

  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : Math.round(num);
}

function normalizePajakRow(d) {
  return {
    nama: normalizeEmpty(d.nama),
    dusun: normalizeEmpty(d.dusun),
    nop: normalizeNop(d.nop),
    jumlah: normalizeCurrency(d.jumlah),
  };
}

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function deduplicateByNop(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.nop) continue;
    map.set(row.nop, row);
  }

  return Array.from(map.values());
}

function rowToValues(row) {
  return [
    row.nama,
    row.dusun,
    row.nop,
    row.jumlah,
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

async function upsertPajakBatch(client, rows) {
  if (!rows.length) return 0;

  const values = [];
  const valuePlaceholders = [];
  const columnCount = 4;

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
    INSERT INTO pajak (
      nama, dusun, nop, jumlah
    ) VALUES
      ${valuePlaceholders.join(", ")}
    ON CONFLICT (nop) DO UPDATE SET
      nama = EXCLUDED.nama,
      dusun = EXCLUDED.dusun,
      jumlah = EXCLUDED.jumlah,
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

    console.log("📥 Pajak import request body keys:", Object.keys(req.body || {}));
    console.log("📥 Pajak import request received, data count:", data?.length || 0);

    if (!Array.isArray(data) || data.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: "Data pajak kosong",
      });
    }

    const validData = data.filter((d) => d && d.nop && String(d.nop).trim() !== "");

    if (validData.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: "Tidak ada data valid (NOP kosong)",
      });
    }

    const normalizedRows = validData.map(normalizePajakRow);
    const dedupedRows = deduplicateByNop(normalizedRows);

    console.log(`🧹 Setelah deduplicate NOP: ${dedupedRows.length}/${normalizedRows.length}`);

    await client.query("BEGIN");

    let insertedOrUpdated = 0;
    const batches = chunkArray(dedupedRows, IMPORT_BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await upsertPajakBatch(client, batch);
      insertedOrUpdated += batch.length;
      console.log(`✅ Pajak batch ${i + 1}/${batches.length}: ${insertedOrUpdated}/${dedupedRows.length}`);
    }

    await client.query("COMMIT");
    client.release();

    return res.json({
      success: true,
      message: "Import data pajak selesai (insert & update)",
      affectedRows: insertedOrUpdated,
      insertedRows: insertedOrUpdated,
      updatedRows: 0,
      totalInput: normalizedRows.length,
      totalUniqueNop: dedupedRows.length,
      skippedDuplicatesInFile: normalizedRows.length - dedupedRows.length,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("❌ Pajak rollback error:", rollbackErr);
    }

    client.release();

    console.error("❌ Pajak import error:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal import data pajak",
      error: err.message,
      code: err.code,
    });
  }
});

/* =====================================================
   LIST DUSUN PAJAK
===================================================== */
router.get("/dusun/list", async (req, res) => {
  try {
    const result = await safeQuery(`
      SELECT DISTINCT dusun
      FROM pajak
      WHERE dusun IS NOT NULL AND TRIM(dusun) != ''
      ORDER BY dusun ASC
    `);

    return res.json(result.rows.map((row) => row.dusun));
  } catch (err) {
    console.error("❌ Pajak dusun list error:", err);
    return res.status(500).json({ message: "Gagal mengambil daftar dusun pajak" });
  }
});

/* =====================================================
   EXPORT ALL DATA PAJAK
===================================================== */
router.get("/export/excel", async (req, res) => {
  try {
    const sql = `
      SELECT
        nama as "Nama",
        dusun as "Dusun",
        nop as "NOP",
        jumlah as "Jumlah"
      FROM pajak
      ORDER BY dusun ASC, nama ASC, nop ASC
    `;

    const result = await safeQuery(sql);

    console.log("✅ Pajak export success:", result.rows.length, "rows");

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Pajak export error:", err);
    return res.status(500).json({ message: "Gagal export data pajak" });
  }
});

/* =====================================================
   GET DATA PAJAK (LIST)
===================================================== */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const search = (req.query.search || "").trim();
    const dusun = (req.query.dusun || "").trim();
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];
    let index = 1;

    if (search) {
      whereClause += ` AND (
        nama ILIKE $${index}
        OR nop ILIKE $${index + 1}
        OR CAST(jumlah AS TEXT) ILIKE $${index + 2}
      )`;

      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
      index += 3;
    }

    if (dusun) {
      whereClause += ` AND dusun = $${index}`;
      params.push(dusun);
      index += 1;
    }

    const sqlCount = `
      SELECT COUNT(*)::int AS total
      FROM pajak
      ${whereClause}
    `;

    const countResult = await safeQuery(sqlCount, params);
    const total = countResult.rows[0]?.total || 0;
    const totalPage = Math.max(1, Math.ceil(total / limit));

    const sqlData = `
      SELECT *
      FROM pajak
      ${whereClause}
      ORDER BY dusun ASC NULLS LAST, nama ASC NULLS LAST, nop ASC
      LIMIT $${index} OFFSET $${index + 1}
    `;

    const dataResult = await safeQuery(sqlData, [...params, limit, offset]);

    return res.json({
      data: dataResult.rows,
      page,
      limit,
      totalData: total,
      totalPage,
    });
  } catch (err) {
    console.error("❌ Pajak fetch error:", err);
    return res.status(500).json({ message: "Gagal ambil data pajak" });
  }
});

/* =====================================================
   GET SINGLE DATA PAJAK BY ID
===================================================== */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID harus berupa angka" });
    }

    const result = await safeQuery("SELECT * FROM pajak WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Data pajak tidak ditemukan" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Pajak get single error:", err);
    return res.status(500).json({ message: "Gagal mengambil data pajak" });
  }
});

/* =====================================================
   INSERT DATA PAJAK BARU
===================================================== */
router.post("/", async (req, res) => {
  try {
    const d = normalizePajakRow(req.body);

    if (!d.nop || !String(d.nop).trim()) {
      return res.status(400).json({
        success: false,
        message: "NOP wajib diisi",
      });
    }

    if (!d.nama) {
      return res.status(400).json({
        success: false,
        message: "Nama wajib diisi",
      });
    }

    const sql = `
      INSERT INTO pajak (
        nama, dusun, nop, jumlah
      ) VALUES (
        $1, $2, $3, $4
      )
    `;

    const values = rowToValues(d);
    const result = await safeQuery(sql, values);

    return res.json({
      success: true,
      message: "Data pajak berhasil ditambahkan",
      affectedRows: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Pajak insert error:", err);

    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "NOP sudah ada, gunakan edit atau import update",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal menambah data pajak",
      error: err.message,
    });
  }
});

/* =====================================================
   UPDATE DATA PAJAK
===================================================== */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = { ...req.body };

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID harus berupa angka",
      });
    }

    delete data.id;
    delete data.created_at;

    data.updated_at = new Date();

    if (data.nop !== undefined) data.nop = normalizeNop(data.nop);
    if (data.jumlah !== undefined) data.jumlah = normalizeCurrency(data.jumlah);

    Object.keys(data).forEach((key) => {
      if (typeof data[key] === "string") {
        data[key] = normalizeEmpty(data[key]);
      }
    });

    const entries = Object.entries(data).filter(([key]) => allowedColumns.includes(key));

    if (entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada data yang bisa diperbarui",
      });
    }

    const setClause = entries.map(([key], idx) => `${key} = $${idx + 1}`).join(", ");
    const values = entries.map(([, value]) => value);
    values.push(id);

    const sql = `UPDATE pajak SET ${setClause} WHERE id = $${values.length}`;
    const result = await safeQuery(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Data pajak tidak ditemukan",
      });
    }

    console.log("✅ Pajak update success, ID:", id);

    return res.json({
      success: true,
      message: "Data pajak berhasil diperbarui",
      affectedRows: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Pajak update error:", err);

    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "NOP sudah digunakan data lain",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui data pajak",
      error: err.message,
    });
  }
});

/* =====================================================
   DELETE DATA PAJAK
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID harus berupa angka",
      });
    }

    const result = await safeQuery("DELETE FROM pajak WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Data pajak tidak ditemukan",
      });
    }

    console.log("✅ Pajak delete success, ID:", id);

    return res.json({
      success: true,
      message: "Data pajak berhasil dihapus",
      affectedRows: result.rowCount,
    });
  } catch (err) {
    console.error("❌ Pajak delete error:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal menghapus data pajak",
    });
  }
});

module.exports = router;