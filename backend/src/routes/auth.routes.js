"use strict";

const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const {
  findUserByEmail,
  findUserByUsername,
  addUser,
} = require("../db");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body || {};
  const u = String(username || "").trim();
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");

  if (u.length < 3) return res.status(400).json({ error: "Username minim 3 caractere." });
  if (!/^[a-zA-Z0-9._-]+$/.test(u)) {
    return res.status(400).json({ error: "Username poate conține doar litere/cifre și . _ -" });
  }
  if (!e || !e.includes("@")) return res.status(400).json({ error: "Email invalid." });
  if (p.length < 6) return res.status(400).json({ error: "Parola minim 6 caractere." });

  if (findUserByUsername(u)) return res.status(409).json({ error: "Username deja folosit." });
  if (findUserByEmail(e)) return res.status(409).json({ error: "Email deja folosit." });

  const user = {
    id: "u-" + crypto.randomUUID(),
    username: u,
    email: e,
    passwordHash: await bcrypt.hash(p, 10),
    role: "CLIENT",
    createdAt: new Date().toISOString(),
  };

  addUser(user);
  return res.status(201).json({ ok: true });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const u = String(username || "").trim();
  const p = String(password || "");

  const user = findUserByUsername(u);
  if (!user) return res.status(401).json({ error: "Username sau parolă greșite." });

  const ok = await bcrypt.compare(p, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Username sau parolă greșite." });

  req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
  return res.json({ ok: true, user: req.session.user });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

module.exports = router;
