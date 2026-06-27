"use strict";

const express = require("express");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcryptjs");

const { PORT, SESSION_SECRET } = require("./config");
const { findUserByUsername, addUser } = require("./db");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const videosRoutes = require("./routes/videos.routes");
const suggestionsRoutes = require("./routes/suggestions.routes");

const app = express();

app.use(express.static(path.join(__dirname, "..", "..", "frontend")));
app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

(function seedAdminOnce() {
  const existing = findUserByUsername("admin");

  if (!existing) {
    addUser({
      id: "admin",
      username: "admin",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "ADMIN",
      createdAt: new Date().toISOString(),
    });

    console.log("Admin seed: username=admin / password=admin123");
  }
})();

app.use("/api", authRoutes);
app.use("/api", usersRoutes);
app.use("/api", videosRoutes);
app.use("/api", suggestionsRoutes);

app.use((err, req, res, next) => {
  console.error("EROARE SERVER:", err);
  res.status(500).json({ error: err.message || "Eroare server" });
});

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
});