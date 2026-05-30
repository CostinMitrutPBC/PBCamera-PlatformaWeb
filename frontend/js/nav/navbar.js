"use strict";

import { getMeSafe } from "../core/api.js";
import { goto, isPage } from "../core/utils.js";
import { doLogout } from "../core/auth.js";

async function goToVideosSmart() {
  const me = await getMeSafe();
  if (!me.user) return goto("login.html");
  if (me.user.role === "ADMIN") return goto("admin.html");
  return goto("client.html");
}

export async function initGlobalNav() {
  try {
    const videosNavBtn = document.getElementById("videosNavBtn");
    const authNavBtn = document.getElementById("authNavBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const meLabel = document.getElementById("meLabel");

    const me = await getMeSafe();
    const loggedIn = !!me.user;
    const role = me.user?.role || null;

    if (meLabel) {
      meLabel.textContent = loggedIn
        ? `Logat ca: ${me.user.username} (${me.user.role})`
        : "Neautentificat";
    }

    if (videosNavBtn) {
      videosNavBtn.textContent = role === "ADMIN" ? "Dashboard" : "Galerie";

      const shouldHide =
        (role === "ADMIN" && isPage("admin.html")) ||
        (role !== "ADMIN" && isPage("client.html"));

      if (shouldHide) {
        videosNavBtn.style.display = "none";
      } else {
        const clone = videosNavBtn.cloneNode(true);
        videosNavBtn.parentNode.replaceChild(clone, videosNavBtn);
        clone.addEventListener("click", goToVideosSmart);
      }
    }

    if (authNavBtn) {
      const clone = authNavBtn.cloneNode(true);
      authNavBtn.parentNode.replaceChild(clone, authNavBtn);

      if (loggedIn) {
        clone.textContent = "Logout";
        clone.addEventListener("click", doLogout);
      } else {
        clone.textContent = "Login";
        clone.addEventListener("click", () => goto("login.html"));
      }
    }

    if (logoutBtn) {
      const clone = logoutBtn.cloneNode(true);
      logoutBtn.parentNode.replaceChild(clone, logoutBtn);
      clone.addEventListener("click", doLogout);
    }
  } catch (e) {
    console.error("initGlobalNav error:", e);
  }
}
