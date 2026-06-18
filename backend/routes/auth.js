const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("Login attempt:", { username });

    const sql = `
      SELECT id, username, password, role
      FROM public.users
      WHERE username = $1
      LIMIT 1
    `;

    const result = await db.query(sql, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Username tidak ditemukan" });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(401).json({ message: "Password salah" });
    }

    res.json({
      message: "Login berhasil",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;