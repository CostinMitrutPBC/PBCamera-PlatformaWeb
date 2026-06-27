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
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(
      {
        users: Array.isArray(db.users) ? db.users : [],
        videos: Array.isArray(db.videos) ? db.videos : [],
        suggestions: Array.isArray(db.suggestions) ? db.suggestions : [],
      },
      null,
      2
    ),
    "utf-8"
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
  return readDb().users.filter((u) => u && u.role === "CLIENT");
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

  const suggestion = db.suggestions.find((x) => x && x.id === id);
  if (!suggestion) return null;

  suggestion.resolved = true;
  suggestion.resolvedAt = new Date().toISOString();

  writeDb(db);
  return suggestion;
}

function removeClientCascade(clientId) {
  const db = readDb();
  const target = String(clientId || "");

  const userIndex = db.users.findIndex((u) => u && u.id === target);
  if (userIndex === -1) return null;

  const [removedUser] = db.users.splice(userIndex, 1);

  const removedVideos = [];
  const removedVideoIds = new Set();

  db.videos = db.videos.filter((v) => {
    if (v && v.clientId === target) {
      removedVideos.push(v);
      removedVideoIds.add(v.id);
      return false;
    }

    return true;
  });

  const removedSuggestions = [];

  db.suggestions = db.suggestions.filter((s) => {
    const belongsToUser = s && s.userId === target;
    const belongsToRemovedVideo = s && removedVideoIds.has(s.videoId);

    if (belongsToUser || belongsToRemovedVideo) {
      removedSuggestions.push(s);
      return false;
    }

    return true;
  });

  writeDb(db);

  return {
    removedUser,
    removedVideos,
    removedSuggestions,
  };
}

module.exports = {
  findUserByUsername,
  findUserById,

  addUser,
  listUsers,
  listClients,

  addVideo,
  listVideos,
  getVideoById,
  removeVideoById,

  addSuggestion,
  listSuggestions,
  resolveSuggestion,

  removeClientCascade,
};