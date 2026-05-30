"use strict";

import { api, getMeSafe } from "../core/api.js";
import { goto, escapeHtml } from "../core/utils.js";

async function deleteClient(user) {
  const ok = confirm(
    `Sigur vrei să ștergi DEFINITIV acest client?\n\n` +
    `Username: ${user.username}\nEmail: ${user.email}\n\n` +
    `Se vor șterge și videourile lui de pe disc.`
  );
  if (!ok) return;

  await api(`/api/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
}

export async function initAdminUsers() {
  const me = await getMeSafe();
  if (!me.user) return goto("login.html");
  if (me.user.role !== "ADMIN") return goto("client.html");

  const { users } = await api("/api/users");

  const tbody = document.getElementById("usersTbody");
  const cnt = document.getElementById("usersCount");

  if (cnt) cnt.textContent = `Total conturi: ${users.length}`;
  if (!tbody) return;

  tbody.innerHTML = users
    .map((u) => {
      const created = u.createdAt ? new Date(u.createdAt).toLocaleString("ro-RO") : "";
      const isClient = u.role === "CLIENT";

      return `
        <tr>
          <td>${escapeHtml(u.username || "")}</td>
          <td><code>${escapeHtml(u.id)}</code></td>
          <td>${escapeHtml(u.email || "")}</td>
          <td>${escapeHtml(u.role)}</td>
          <td>${escapeHtml(created)}</td>
          <td>
            ${
              isClient
                ? `<button class="btn danger" data-del="${escapeHtml(u.id)}">Șterge</button>`
                : `<span class="small">—</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      const user = users.find((x) => x.id === id);
      if (!user) return;

      try {
        await deleteClient(user);
        await initAdminUsers(); // refresh
      } catch (e) {
        alert(e.message || "Eroare la ștergere");
      }
    });
  });
}
