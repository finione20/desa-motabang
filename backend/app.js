require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./config/database");

const app = express();

const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://desamotabang.netlify.app",
];

app.set("trust proxy", 1);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin tidak diizinkan oleh CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
const authRoute = require("./routes/auth");
const pendudukRoute = require("./routes/penduduk");
const pajakRoute = require("./routes/pajak");
const registerSuratRoute = require("./routes/registerSurat");

app.use("/api/auth", authRoute);
app.use("/api/penduduk", pendudukRoute);
app.use("/api/pajak", pajakRoute);
app.use("/api/register-surat", registerSuratRoute);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Server Website Desa Aktif",
    status: "running",
    timestamp: new Date().toISOString(),
    services: ["auth", "penduduk", "pajak", "register-surat"],
  });
});

// Test database endpoint
app.get("/api/test-db", async (req, res) => {
  try {
    const result = await db.query("SELECT 1 + 1 AS solution");

    res.json({
      status: "success",
      message: "Database connected",
      result: result.rows[0].solution,
      database: "PostgreSQL / Supabase",
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: err.message,
    });
  }
});

// Debug users
app.get("/api/debug-users", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        username,
        length(username) AS username_length,
        quote_literal(username) AS raw_username,
        role
      FROM public.users
      ORDER BY id ASC
    `);

    res.json({
      status: "success",
      total: result.rows.length,
      users: result.rows,
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Gagal membaca public.users",
      error: err.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Express error:", err);

  if (err.message && err.message.startsWith("Origin tidak diizinkan oleh CORS")) {
    return res.status(403).json({
      status: "error",
      message: err.message,
    });
  }

  return res.status(500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint tidak ditemukan",
    path: req.originalUrl,
  });
});

module.exports = app;