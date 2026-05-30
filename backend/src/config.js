const path = require("path");

module.exports = {
  PORT: 3000,

  STORAGE_DIR: path.join(__dirname, "..", "storage"),

  SESSION_SECRET: "dev-secret-change-me",
};