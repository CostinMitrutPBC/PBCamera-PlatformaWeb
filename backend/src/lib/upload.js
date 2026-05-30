"use strict";

const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { STORAGE_DIR } = require("../config");

fs.mkdirSync(STORAGE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  const okVideo = file.mimetype.startsWith("video/");
  const okImage = file.mimetype.startsWith("image/");

  if (!okVideo && !okImage) {
    return cb(new Error("Doar fișiere imagine sau video sunt permise."), false);
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 1024 },
});

module.exports = { upload };