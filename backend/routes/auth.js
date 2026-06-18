const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const sql = "SELECT id, username, role FROM users WHERE username = $1 AND password = $2 LIMIT 1";
    const result = await db.query(sql, [username, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Username atau password salah" });
    }

    res.json({
      message: "Login berhasil",
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        role: result.rows[0].role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;