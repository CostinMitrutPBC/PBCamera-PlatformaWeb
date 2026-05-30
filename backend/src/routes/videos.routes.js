"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { STORAGE_DIR } = require("../config");
const { upload } = require("../lib/upload");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  addVideo,
  listVideos,
  getVideoById,
  removeVideoById,
} = require("../db");

const {
  FFMPEG,
  ffmpegAvailable,
  sanitizeNoRotate,
  sanitizeRotate90A,
} = require("../lib/ffmpeg");

const router = express.Router();
const DB_PATH = path.join(__dirname, "..", "data.json");

function isVideoMime(mime) {
  return String(mime || "").startsWith("video/");
}

function isImageMime(mime) {
  return String(mime || "").startsWith("image/");
}

function readDbFile() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDbFile(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function updateVideoEditedData(videoId, editedData) {
  const db = readDbFile();

  if (!Array.isArray(db.videos)) db.videos = [];
  if (!Array.isArray(db.suggestions)) db.suggestions = [];

  const item = db.videos.find((v) => v && v.id === videoId);
  if (!item) return null;

  Object.assign(item, editedData);

  db.suggestions = db.suggestions.map((s) => {
    if (s && s.videoId === videoId) {
      return {
        ...s,
        resolved: true,
        resolvedAt: new Date().toISOString(),
      };
    }
    return s;
  });

  writeDbFile(db);
  return item;
}

function processUploadedFile(file, forceRotate) {
  const originalNameOnDisk = file.filename;
  const originalPath = path.join(STORAGE_DIR, originalNameOnDisk);

  let finalName = originalNameOnDisk;
  let finalPath = originalPath;

  let normalized = false;
  let method = "multer-only";

  const mime = file.mimetype || "application/octet-stream";
  const mediaType = isImageMime(mime) ? "image" : "video";

  if (!fs.existsSync(originalPath)) {
    throw new Error("Multer a raportat upload OK, dar fișierul nu există pe disc.");
  }

  if (mediaType === "video") {
    if (ffmpegAvailable()) {
      const fixedName = `fixed-${originalNameOnDisk}`;
      const fixedPath = path.join(STORAGE_DIR, fixedName);

      try {
        if (String(forceRotate || "") === "1") {
          sanitizeRotate90A(originalPath, fixedPath);
          method = "sanitize+transpose90(A)";
        } else {
          sanitizeNoRotate(originalPath, fixedPath);
          method = "sanitize(no-rotate)";
        }

        if (fs.existsSync(fixedPath) && fs.statSync(fixedPath).size > 0) {
          try {
            fs.unlinkSync(originalPath);
          } catch {}

          finalName = fixedName;
          finalPath = fixedPath;
          normalized = true;
        } else {
          try {
            if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath);
          } catch {}

          method = `${method} => produced-empty => kept-original`;
        }
      } catch (e) {
        try {
          if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath);
        } catch {}

        method = "ffmpeg-failed => kept-original";
        console.error("FFmpeg FAIL:", e.message);
      }
    } else {
      method = "ffmpeg-missing => kept-original";
      console.log("FFmpeg indisponibil la:", FFMPEG);
    }
  } else {
    method = "image-upload";
  }

  if (!fs.existsSync(finalPath)) {
    throw new Error("După procesare, fișierul final nu există pe disc.");
  }

  return {
    mediaType,
    finalName,
    finalPath,
    finalMime: mediaType === "video" ? "video/mp4" : mime,
    finalSize: fs.statSync(finalPath).size,
    normalized,
    method,
  };
}

router.post("/videos/upload", requireAdmin, upload.single("video"), (req, res) => {
  const { clientId, forceRotate } = req.body || {};

  if (!clientId) return res.status(400).json({ error: "Lipsește clientId" });
  if (!req.file) return res.status(400).json({ error: "Lipsește fișierul (field: video)" });

  try {
    const result = processUploadedFile(req.file, forceRotate);

    const item = {
      id: crypto.randomUUID(),
      clientId,
      type: result.mediaType,

      originalName: req.file.originalname,
      storedName: result.finalName,
      storedPath: result.finalPath,
      mime: result.finalMime,
      size: result.finalSize,

      hasEdited: false,
      editedName: null,
      editedStoredName: null,
      editedStoredPath: null,
      editedMime: null,
      editedSize: null,
      editedAt: null,

      uploadedAt: new Date().toISOString(),
    };

    addVideo(item);

    return res.status(201).json({
      ok: true,
      video: item,
      normalized: result.normalized,
      method: result.method,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Eroare la upload.",
      debug: { STORAGE_DIR },
    });
  }
});

router.post("/videos/:id/upload-edited", requireAdmin, upload.single("video"), (req, res) => {
  const { forceRotate } = req.body || {};
  const item = getVideoById(req.params.id);

  if (!item) return res.status(404).json({ error: "Fișier inexistent" });
  if (!req.file) return res.status(400).json({ error: "Lipsește fișierul editat." });

  try {
    const result = processUploadedFile(req.file, forceRotate);

    if (item.type && item.type !== result.mediaType) {
      try {
        if (result.finalPath && fs.existsSync(result.finalPath)) fs.unlinkSync(result.finalPath);
      } catch {}

      return res.status(400).json({
        error: "Fișierul editat trebuie să fie de același tip ca originalul.",
      });
    }

    if (item.editedStoredPath && fs.existsSync(item.editedStoredPath)) {
      try {
        fs.unlinkSync(item.editedStoredPath);
      } catch {}
    }

    const updated = updateVideoEditedData(item.id, {
      hasEdited: true,
      editedName: req.file.originalname,
      editedStoredName: result.finalName,
      editedStoredPath: result.finalPath,
      editedMime: result.finalMime,
      editedSize: result.finalSize,
      editedAt: new Date().toISOString(),
    });

    if (!updated) return res.status(404).json({ error: "Fișier inexistent" });

    return res.json({
      ok: true,
      video: updated,
      normalized: result.normalized,
      method: result.method,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Eroare la upload editat.",
      debug: { STORAGE_DIR },
    });
  }
});

router.get("/videos", requireAuth, (req, res) => {
  const all = listVideos();

  if (req.session.user.role === "ADMIN") {
    return res.json({ videos: all });
  }

  return res.json({
    videos: all.filter((v) => v.clientId === req.session.user.id),
  });
});

router.get("/videos/:id/stream", requireAuth, (req, res) => {
  const v = getVideoById(req.params.id);
  if (!v) return res.status(404).json({ error: "Fișier inexistent" });

  if (req.session.user.role === "CLIENT" && v.clientId !== req.session.user.id) {
    return res.status(403).json({ error: "Nu ai acces la acest fișier" });
  }

  const useEdited = req.query.edited === "1" && v.hasEdited && v.editedStoredPath;

  const selectedStoredName = useEdited ? v.editedStoredName : v.storedName;
const selectedStoredPath = useEdited ? v.editedStoredPath : v.storedPath;

const filePath = selectedStoredName
  ? path.join(STORAGE_DIR, selectedStoredName)
  : selectedStoredPath;
  const contentType = useEdited
    ? v.editedMime || v.mime || "application/octet-stream"
    : v.mime || "application/octet-stream";

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Fișierul nu mai există pe disc" });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!isVideoMime(contentType)) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (!range) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize) {
    return res.status(416).send("Range Not Satisfiable");
  }

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": contentType,
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

router.delete("/videos/:id", requireAdmin, (req, res) => {
  const v = removeVideoById(req.params.id);
  if (!v) return res.status(404).json({ error: "Fișier inexistent" });

  try {
    if (v.storedPath && fs.existsSync(v.storedPath)) fs.unlinkSync(v.storedPath);
    if (v.editedStoredPath && fs.existsSync(v.editedStoredPath)) fs.unlinkSync(v.editedStoredPath);
  } catch (err) {
    return res.status(500).json({
      error: "Fișier șters din listă, dar nu a putut fi șters de pe disc.",
      details: err.message,
    });
  }

  return res.json({ ok: true });
});

module.exports = router;