"use strict";

const express = require("express");
const fs = require("fs");

const {
  listUsers,
  listClients,
  findUserById,
  removeClientCascade,
} = require("../db");

const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/clients", requireAuth, (req, res) => {
  const clients = listClients().map((u) => ({
    id: u.id,
    username: u.username,
  }));

  res.json({ clients });
});

router.get("/users", requireAdmin, (req, res) => {
  const users = listUsers().map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
  }));

  res.json({ users });
});

router.delete("/users/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id || "").trim();

  if (!id) {
    return res.status(400).json({ error: "Lipsește id" });
  }

  const user = findUserById(id);

  if (!user) {
    return res.status(404).json({ error: "User inexistent" });
  }

  if (user.role === "ADMIN") {
    return res.status(400).json({ error: "Nu poți șterge un admin." });
  }

  const result = removeClientCascade(id);

  if (!result) {
    return res.status(500).json({
      error: "Nu am putut șterge clientul din DB.",
    });
  }

  const deletedFiles = [];
  const failedFiles = [];

  for (const v of result.removedVideos) {
    const paths = [v.storedPath, v.editedStoredPath].filter(Boolean);

    for (const filePath of paths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFiles.push(filePath);
        }
      } catch (e) {
        failedFiles.push({
          path: filePath,
          error: e.message,
        });
      }
    }
  }

  return res.json({
    ok: true,
    removedUser: {
      id: result.removedUser.id,
      username: result.removedUser.username,
    },
    removedVideosCount: result.removedVideos.length,
    removedSuggestionsCount: result.removedSuggestions.length,
    deletedFilesCount: deletedFiles.length,
    failedFiles,
  });
});

module.exports = router;