const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

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

    if (user.password !== password) {
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
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;