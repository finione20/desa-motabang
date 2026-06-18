const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.post("/login", async (req, res) => {
  try {
    let body = req.body;

    if (Buffer.isBuffer(body)) {
      body = JSON.parse(body.toString("utf8"));
    } else if (body && body.type === "Buffer" && Array.isArray(body.data)) {
      body = JSON.parse(Buffer.from(body.data).toString("utf8"));
    } else if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password.trim() : "";

    if (!username || !password) {
      return res.status(400).json({ message: "Username dan password wajib diisi" });
    }

    const result = await db.query(
      `
      SELECT id, username, password, role
      FROM public.users
      WHERE trim(lower(username)) = trim(lower($1))
      LIMIT 1
      `,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Username tidak ditemukan" });
    }

    const user = result.rows[0];

    if ((user.password || "").trim() !== password) {
      return res.status(401).json({ message: "Password salah" });
    }

    return res.json({
      message: "Login berhasil",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
});

module.exports = router;