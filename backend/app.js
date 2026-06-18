require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const db = require("./config/database");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const authRoute = require("./routes/auth");
app.use("/api/auth", authRoute);

const pendudukRoute = require("./routes/penduduk");
app.use("/api/penduduk", pendudukRoute);

const registerSuratRoute = require("./routes/registerSurat");
app.use("/api/register-surat", registerSuratRoute);

app.get("/", (req, res) => {
  res.json({
    message: "Server Website Desa Aktif",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

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

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint tidak ditemukan",
  });
});

module.exports = app;