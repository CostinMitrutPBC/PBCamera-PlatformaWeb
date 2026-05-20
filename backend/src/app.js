// backend/src/app.js
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { spawnSync } = require("child_process");

const { PORT, STORAGE_DIR, SESSION_SECRET } = require("./config");
const {
  findUserByEmail,
  findUserByUsername,
  addUser,
  listUsers,
  listClients,
  addVideo,
  listVideos,
  getVideoById,
  removeVideoById,
} = require("./db");

const app = express();

// ====== FFmpeg (direct path) ======
const FFMPEG = "D:\\ffmpeg\\bin\\ffmpeg.exe";
const FFPROBE = "D:\\ffmpeg\\bin\\ffprobe.exe";

function ffmpegAvailable() {
  try {
    const a = spawnSync(FFMPEG, ["-version"], { encoding: "utf-8" });
    const b = spawnSync(FFPROBE, ["-version"], { encoding: "utf-8" });
    return a.status === 0 && b.status === 0;
  } catch {
    return false;
  }
}

/**
 * Re-encode curat, FĂRĂ rotate / matrix / metadata.
 * IMPORTANT: NU scale, NU crop. Păstrează rezoluția originală.
 */
function sanitizeNoRotate(inputPath, outputPath) {
  const run = spawnSync(
    FFMPEG,
    [
      "-y",
      "-noautorotate",
      "-i",
      inputPath,

      // NU scale! doar SAR=1 + format compatibil
      "-vf",
      "setsar=1,format=yuv420p",

      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-preset",
      "veryfast",

      "-c:a",
      "aac",
      "-b:a",
      "192k",

      // curățăm metadata
      "-map_metadata",
      "-1",
      "-metadata:s:v:0",
      "rotate=0",
      "-movflags",
      "+faststart",

      outputPath,
    ],
    { encoding: "utf-8" }
  );

  if (run.status !== 0) {
    throw new Error("FFmpeg sanitizeNoRotate failed: " + (run.stderr || "unknown"));
  }
}

/**
 * Varianta A: transpose=1 + re-encode curat + strip metadata
 * Folosește doar când vrei să forțezi rotire 90°.
 */
function sanitizeRotate90A(inputPath, outputPath) {
  const run = spawnSync(
    FFMPEG,
    [
      "-y",
      "-noautorotate",
      "-i",
      inputPath,

      "-vf",
      "transpose=1,setsar=1,format=yuv420p",

      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-preset",
      "veryfast",

      "-c:a",
      "aac",
      "-b:a",
      "192k",

      "-map_metadata",
      "-1",
      "-metadata:s:v:0",
      "rotate=0",
      "-movflags",
      "+faststart",

      outputPath,
    ],
    { encoding: "utf-8" }
  );

  if (run.status !== 0) {
    throw new Error("FFmpeg sanitizeRotate90A failed: " + (run.stderr || "unknown"));
  }
}

// ===== Servește frontend =====
app.use(express.static(path.join(__dirname, "..", "..", "frontend")));
app.use(express.json());

// ===== Session =====
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

// ===== Auth middleware =====
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Neautentificat" });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Doar admin" });
  }
  next();
}

// ===== Seed admin =====
(function seedAdminOnce() {
  const existing = findUserByEmail("admin@pbcamera.local");
  if (!existing) {
    addUser({
      id: "admin",
      username: "admin",
      email: "admin@pbcamera.local",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "ADMIN",
      createdAt: new Date().toISOString(),
    });
    console.log("Admin seed: username=admin / password=admin123");
  }
})();

// ===== Auth routes =====
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body || {};
  const u = String(username || "").trim();
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");

  if (u.length < 3) return res.status(400).json({ error: "Username minim 3 caractere." });
  if (!/^[a-zA-Z0-9._-]+$/.test(u))
    return res.status(400).json({ error: "Username poate conține doar litere/cifre și . _ -" });
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

app.post("/api/login", async (req, res) => {
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

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

// dropdown clienți (admin)
app.get("/api/clients", requireAuth, (req, res) => {
  const clients = listClients().map((u) => ({ id: u.id, username: u.username, email: u.email }));
  res.json({ clients });
});

// listă useri (admin)
app.get("/api/users", requireAdmin, (req, res) => {
  const users = listUsers().map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  }));
  res.json({ users });
});

// ===== Storage dir =====
fs.mkdirSync(STORAGE_DIR, { recursive: true });

// ===== Multer upload =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("video/")) return cb(new Error("Doar fișiere video sunt permise."), false);
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
});

// ===== Upload (ADMIN) =====
app.post("/api/videos/upload", requireAdmin, upload.single("video"), (req, res) => {
  const { clientId, forceRotate } = req.body || {};
  if (!clientId) return res.status(400).json({ error: "Lipsește clientId" });
  if (!req.file) return res.status(400).json({ error: "Lipsește fișierul (field: video)" });

  // multer a salvat deja fișierul aici
  const originalNameOnDisk = req.file.filename;
  const originalPath = path.join(STORAGE_DIR, originalNameOnDisk);

  let finalName = originalNameOnDisk;
  let finalPath = originalPath;

  let normalized = false;
  let method = "multer-only";

  // IMPORTANT: dacă multer n-a salvat, e problemă mare
  if (!fs.existsSync(originalPath)) {
    return res.status(500).json({
      error: "Multer a raportat upload OK, dar fișierul nu există pe disc.",
      debug: { STORAGE_DIR, originalPath },
    });
  }

  if (ffmpegAvailable()) {
    const fixedName = `fixed-${originalNameOnDisk}`;
    const fixedPath = path.join(STORAGE_DIR, fixedName);

    try {
      // Dacă vrei să păstrezi butonul/checkboxul, îl lași.
      // Dacă vrei să-l scoți, poți șterge complet ramura asta și să rămâi doar cu sanitizeNoRotate.
      if (String(forceRotate || "") === "1") {
        sanitizeRotate90A(originalPath, fixedPath);
        method = "sanitize+transpose90(A)";
      } else {
        sanitizeNoRotate(originalPath, fixedPath);
        method = "sanitize(no-rotate)";
      }

      // ștergem originalul DOAR dacă fixed există și are dimensiune > 0
      if (fs.existsSync(fixedPath) && fs.statSync(fixedPath).size > 0) {
        try {
          fs.unlinkSync(originalPath);
        } catch {}

        finalName = fixedName;
        finalPath = fixedPath;
        normalized = true;
      } else {
        // fallback: păstrăm originalul
        try {
          if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath);
        } catch {}
        method = method + " => produced-empty => kept-original";
      }
    } catch (e) {
      // fallback: păstrăm originalul
      try {
        if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath);
      } catch {}
      method = `ffmpeg-failed => kept-original`;
      console.error("FFmpeg FAIL:", e.message);
    }
  } else {
    method = "ffmpeg-missing => kept-original";
    console.log("FFmpeg indisponibil la:", FFMPEG);
  }

  // Verificare finală
  if (!fs.existsSync(finalPath)) {
    return res.status(500).json({
      error: "După procesare, fișierul final nu există pe disc.",
      debug: { STORAGE_DIR, originalPath, finalPath, method },
    });
  }

  const video = {
    id: crypto.randomUUID(),
    clientId,
    originalName: req.file.originalname,
    storedName: finalName,
    storedPath: finalPath,
    mime: "video/mp4",
    size: fs.statSync(finalPath).size,
    uploadedAt: new Date().toISOString(),
  };

  addVideo(video);
  return res.status(201).json({ ok: true, video, normalized, method });
});

// ===== List videos =====
app.get("/api/videos", requireAuth, (req, res) => {
  const all = listVideos();
  if (req.session.user.role === "ADMIN") return res.json({ videos: all });
  return res.json({ videos: all.filter((v) => v.clientId === req.session.user.id) });
});

// ===== Stream (Range) =====
app.get("/api/videos/:id/stream", requireAuth, (req, res) => {
  const v = getVideoById(req.params.id);
  if (!v) return res.status(404).json({ error: "Video inexistent" });

  if (req.session.user.role === "CLIENT" && v.clientId !== req.session.user.id) {
    return res.status(403).json({ error: "Nu ai acces la acest video" });
  }

  const videoPath = v.storedPath;
  if (!fs.existsSync(videoPath)) return res.status(404).json({ error: "Fișierul nu mai există pe disc" });

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, { "Content-Length": fileSize, "Content-Type": v.mime || "video/mp4" });
    fs.createReadStream(videoPath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize) return res.status(416).send("Range Not Satisfiable");

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": v.mime || "video/mp4",
  });

  fs.createReadStream(videoPath, { start, end }).pipe(res);
});

// ===== Delete (ADMIN) =====
app.delete("/api/videos/:id", requireAdmin, (req, res) => {
  const v = removeVideoById(req.params.id);
  if (!v) return res.status(404).json({ error: "Video inexistent" });

  try {
    if (v.storedPath && fs.existsSync(v.storedPath)) fs.unlinkSync(v.storedPath);
  } catch (err) {
    return res.status(500).json({
      error: "Video șters din listă, dar fișierul nu a putut fi șters de pe disc.",
      details: err.message,
    });
  }

  return res.json({ ok: true });
});

// ===== Error handler =====
app.use((err, req, res, next) => {
  console.error("EROARE SERVER:", err);
  res.status(500).json({ error: err.message || "Eroare server" });
});

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Storage: ${STORAGE_DIR}`);
  console.log(`FFmpeg: ${FFMPEG}`);
});
