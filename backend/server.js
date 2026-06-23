require("dotenv").config();

const http = require("http");
const app = require("./app");
const db = require("./config/database");

const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log(`🚀 Server aktif di port ${PORT}`);
  console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`📅 ${new Date().toLocaleString("id-ID")}`);
  console.log("=".repeat(60));
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n⚠️ Menerima ${signal}, memulai graceful shutdown...`);

  server.close(async () => {
    console.log("🛑 HTTP server berhenti menerima koneksi baru.");

    try {
      await db.end();
      console.log("✅ PostgreSQL pool berhasil ditutup.");
      process.exit(0);
    } catch (err) {
      console.error("❌ Gagal menutup PostgreSQL pool:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("❌ Graceful shutdown timeout. Proses dihentikan paksa.");
    process.exit(1);
  }, 15000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});