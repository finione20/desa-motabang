const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.post("/login", async (req, res) => {
  try {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";

    const result = await db.query(
      `
      SELECT id, username, password, role
      FROM public.users
      WHERE trim(lower(username)) = trim(lower($1))
      LIMIT 1
      `,
      [username]
    );

    return res.json({
      debug: true,
      receivedBody: req.body,
      parsedUsername: username,
      parsedPassword: password,
      found: result.rows.length,
      matchedUser: result.rows[0] || null
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;