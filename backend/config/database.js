const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL belum diatur di environment variables");
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 10),
  min: Number(process.env.PG_POOL_MIN || 0),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT || 15000),
  keepAlive: true,
  allowExitOnIdle: !isProduction,
});

pool.on("connect", () => {
  console.log("✅ Supabase PostgreSQL connected!");
});

pool.on("acquire", () => {
  console.log("📦 PostgreSQL client acquired");
});

pool.on("remove", () => {
  console.log("🗑️ PostgreSQL client removed");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL pool error:", {
    message: err.message,
    code: err.code,
    stack: err.stack,
  });
});

module.exports = pool;