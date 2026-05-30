"use strict";

const { spawnSync } = require("child_process");

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

function sanitizeNoRotate(inputPath, outputPath) {
  const run = spawnSync(
    FFMPEG,
    [
      "-y",
      "-noautorotate",
      "-i",
      inputPath,

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

module.exports = {
  FFMPEG,
  FFPROBE,
  ffmpegAvailable,
  sanitizeNoRotate,
  sanitizeRotate90A,
};
