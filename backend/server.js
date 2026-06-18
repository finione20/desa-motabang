require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Database
const db = require("./config/database");

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Log setiap request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
const authRoute = require("./routes/auth");
app.use("/api/auth", authRoute);

const pendudukRoute = require("./routes/penduduk");
app.use("/api/penduduk", pendudukRoute);

const registerSuratRoute = require("./routes/registerSurat");
app.use("/api/register-surat", registerSuratRoute);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Server Website Desa Aktif",
    status: "running",
    timestamp: new Date().toISOString(),
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
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: err.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint tidak ditemukan",
  });
});

// Start server
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📅 ${new Date().toLocaleString("id-ID")}`);
  console.log("=".repeat(50));
});

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});