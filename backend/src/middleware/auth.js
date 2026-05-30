"use strict";

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

module.exports = { requireAuth, requireAdmin };
