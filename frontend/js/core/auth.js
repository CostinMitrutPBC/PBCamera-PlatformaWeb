"use strict";

import { api } from "./api.js";
import { goto } from "./utils.js";

export function initLogin() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("loginUsername")?.value?.trim() || "";
    const password = document.getElementById("loginPassword")?.value || "";

    try {
      const out = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (out.user?.role === "ADMIN") goto("admin.html");
      else goto("client.html");
    } catch (err) {
      alert(err.message);
    }
  });
}

export function initRegister() {
  const registerForm = document.getElementById("registerForm");
  if (!registerForm) return;

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("regUsername")?.value?.trim() || "";
    const password = document.getElementById("regPassword")?.value || "";
    const status = document.getElementById("regStatus");

    if (status) status.textContent = "Se creează contul...";

    try {
      await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (status) status.textContent = "Cont creat! Te poți loga acum.";
      registerForm.reset();
    } catch (err) {
      if (status) status.textContent = `Eroare: ${err.message}`;
      else alert(err.message);
    }
  });
}

export async function doLogout() {
  try {
    await api("/api/logout", { method: "POST" });
  } catch {}
  goto("login.html");
}
