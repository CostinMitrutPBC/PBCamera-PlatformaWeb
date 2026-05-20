const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data.json");

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], videos: [] }, null, 2), "utf-8");
    return;
  }

  // migrare simplă + normalizare
  const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  const db = {
    users: Array.isArray(raw.users) ? raw.users : [],
    videos: Array.isArray(raw.videos) ? raw.videos : [],
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// ===== USERS =====
function findUserByEmail(email) {
  const db = readDb();
  const target = String(email || "").trim().toLowerCase();

  return db.users.find(
    (u) =>
      u &&
      typeof u.email === "string" &&
      u.email.trim().toLowerCase() === target
  );
}

function findUserByUsername(username) {
  const db = readDb();
  const target = String(username || "").trim().toLowerCase();

  return db.users.find(
    (u) =>
      u &&
      typeof u.username === "string" &&
      u.username.trim().toLowerCase() === target
  );
}

function findUserById(id) {
  const db = readDb();
  const target = String(id || "");
  return db.users.find((u) => u && u.id === target);
}

function addUser(user) {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return user;
}

function listUsers() {
  return readDb().users;
}

function listClients() {
  const db = readDb();
  return db.users.filter((u) => u && u.role === "CLIENT");
}

// ===== VIDEOS =====
function addVideo(video) {
  const db = readDb();
  db.videos.unshift(video);
  writeDb(db);
  return video;
}

function listVideos() {
  return readDb().videos;
}

function getVideoById(id) {
  return readDb().videos.find((v) => v && v.id === id);
}

function removeVideoById(id) {
  const db = readDb();
  const idx = db.videos.findIndex((v) => v && v.id === id);
  if (idx === -1) return null;

  const [removed] = db.videos.splice(idx, 1);
  writeDb(db);
  return removed;
}

module.exports = {
  // users
  findUserByEmail,
  findUserByUsername,
  findUserById,
  addUser,
  listUsers,
  listClients,
  // videos
  addVideo,
  listVideos,
  getVideoById,
  removeVideoById,
};
