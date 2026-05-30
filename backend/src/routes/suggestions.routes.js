"use strict";

const express = require("express");
const crypto = require("crypto");
const { addSuggestion, listSuggestions, resolveSuggestion } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.post("/suggestions", requireAuth, (req, res) => {
  const { videoId, message } = req.body || {};
  const user = req.session?.user;

  if (!user) {
    return res.status(401).json({ error: "Neautentificat" });
  }

  if (!videoId || !message || !String(message).trim()) {
    return res.status(400).json({ error: "Date lipsă" });
  }

  const suggestion = {
    id: crypto.randomUUID(),
    videoId,
    userId: user.id,
    username: user.username,
    message: String(message).trim(),
    createdAt: new Date().toISOString(),
    resolved: false,
  };

  addSuggestion(suggestion);
  res.json({ ok: true, suggestion });
});

router.get("/suggestions", requireAdmin, (req, res) => {
  res.json({ suggestions: listSuggestions() });
});

router.patch("/suggestions/:id", requireAdmin, (req, res) => {
  const s = resolveSuggestion(req.params.id);
  if (!s) return res.status(404).json({ error: "Nu există" });

  res.json({ ok: true });
});

module.exports = router;