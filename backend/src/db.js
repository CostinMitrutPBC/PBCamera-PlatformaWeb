const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data.json");

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ users: [], videos: [], suggestions: [] }, null, 2),
      "utf-8"
    );
    return;
  }

  const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));

  const db = {
    users: Array.isArray(raw.users) ? raw.users : [],
    videos: Array.isArray(raw.videos) ? raw.videos : [],
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDb(db) {
  const safeDb = {
    users: Array.isArray(db.users) ? db.users : [],
    videos: Array.isArray(db.videos) ? db.videos : [],
    suggestions: Array.isArray(db.suggestions) ? db.suggestions : [],
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(safeDb, null, 2), "utf-8");
}

function findUserByEmail(email) {
  const db = readDb();
  const target = String(email || "").trim().toLowerCase();
  return db.users.find((u) => u && typeof u.email === "string" && u.email.trim().toLowerCase() === target);
}

function findUserByUsername(username) {
  const db = readDb();
  const target = String(username || "").trim().toLowerCase();
  return db.users.find((u) => u && typeof u.username === "string" && u.username.trim().toLowerCase() === target);
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

function removeUserById(id) {
  const db = readDb();
  const target = String(id || "");
  const idx = db.users.findIndex((u) => u && u.id === target);
  if (idx === -1) return null;

  const [removed] = db.users.splice(idx, 1);
  writeDb(db);
  return removed;
}

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
  const idx = db.videos.findIndex((v) => v && v.id === String(id));
  if (idx === -1) return null;

  const [removed] = db.videos.splice(idx, 1);
  writeDb(db);
  return removed;
}

function removeVideosByClientId(clientId) {
  const db = readDb();
  const target = String(clientId || "");

  const removed = [];
  const kept = [];

  for (const v of db.videos) {
    if (v && v.clientId === target) removed.push(v);
    else kept.push(v);
  }

  db.videos = kept;
  writeDb(db);
  return removed;
}

function addSuggestion(suggestion) {
  const db = readDb();

  if (!Array.isArray(db.suggestions)) {
    db.suggestions = [];
  }

  db.suggestions.unshift(suggestion);
  writeDb(db);
  return suggestion;
}

function listSuggestions() {
  const db = readDb();
  return Array.isArray(db.suggestions) ? db.suggestions : [];
}

function resolveSuggestion(id) {
  const db = readDb();

  if (!Array.isArray(db.suggestions)) {
    db.suggestions = [];
  }

  const suggestion = db.suggestions.find((x) => x && x.id === id);
  if (!suggestion) return null;

  suggestion.resolved = true;
  writeDb(db);
  return suggestion;
}

module.exports = {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  addUser,
  listUsers,
  listClients,
  removeUserById,

  addVideo,
  listVideos,
  getVideoById,
  removeVideoById,
  removeVideosByClientId,

  addSuggestion,
  listSuggestions,
  resolveSuggestion,
};