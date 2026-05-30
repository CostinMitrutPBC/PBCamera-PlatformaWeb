"use strict";

const express = require("express");
const fs = require("fs");

const {
  listUsers,
  listClients,
  findUserById,
  removeUserById,
  removeVideosByClientId,
} = require("../db");

const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/clients", requireAuth, (req, res) => {
  const clients = listClients().map((u) => ({ id: u.id, username: u.username, email: u.email }));
  res.json({ clients });
});

router.get("/users", requireAdmin, (req, res) => {
  const users = listUsers().map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  }));
  res.json({ users });
});

router.delete("/users/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Lipsește id" });

  const user = findUserById(id);
  if (!user) return res.status(404).json({ error: "User inexistent" });

  if (user.role === "ADMIN") {
    return res.status(400).json({ error: "Nu poți șterge un admin." });
  }

  const removedVideos = removeVideosByClientId(id);

  const deletedFiles = [];
  const failedFiles = [];

  for (const v of removedVideos) {
    try {
      if (v?.storedPath && fs.existsSync(v.storedPath)) {
        fs.unlinkSync(v.storedPath);
        deletedFiles.push(v.storedPath);
      }
    } catch (e) {
      failedFiles.push({ path: v?.storedPath, error: e.message });
    }
  }

  const removedUser = removeUserById(id);
  if (!removedUser) return res.status(500).json({ error: "Nu am putut șterge userul din DB." });

  return res.json({
    ok: true,
    removedUser: { id: removedUser.id, username: removedUser.username, email: removedUser.email },
    removedVideosCount: removedVideos.length,
    deletedFilesCount: deletedFiles.length,
    failedFiles,
  });
});

module.exports = router;
