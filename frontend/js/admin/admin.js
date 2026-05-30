"use strict";

import { api, getMeSafe } from "../core/api.js";
import { goto, escapeHtml } from "../core/utils.js";

let ALL_VIDEOS = [];
let CLIENTS = [];
let CLIENTS_MAP = new Map();

let USERS_LOADED = false;
let SUGGESTIONS_LOADED = false;

function bytesToHuman(bytes) {
  const b = Number(bytes) || 0;
  const mb = b / (1024 * 1024);
  if (mb < 1024) return `${Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function getMediaTypeLabel(item) {
  if (item.type === "image" || String(item.mime || "").startsWith("image/")) return "Poză";
  return "Video";
}

function updateStats() {
  const elVideos = document.getElementById("statVideos");
  const elClients = document.getElementById("statClients");
  const elSpace = document.getElementById("statSpace");

  if (elVideos) elVideos.textContent = String(ALL_VIDEOS.length);
  if (elClients) elClients.textContent = String(CLIENTS.length);

  const totalBytes = ALL_VIDEOS.reduce((sum, v) => {
    const originalSize = Number(v.size) || 0;
    const editedSize = Number(v.editedSize) || 0;
    return sum + originalSize + editedSize;
  }, 0);

  if (elSpace) elSpace.textContent = bytesToHuman(totalBytes);
}

function renderVideos(videos) {
  const tableBody = document.getElementById("videosTbody");
  if (!tableBody) return;

  tableBody.innerHTML = videos
    .map((v) => {
      const nameSafe = escapeHtml(v.originalName);
      const date = new Date(v.uploadedAt).toLocaleString("ro-RO");
      const sizeHuman = bytesToHuman(v.size);

      const c = CLIENTS_MAP.get(v.clientId);
      const clientLabel = c ? `${c.username} (${c.id})` : v.clientId;
      const typeLabel = getMediaTypeLabel(v);
      const editedLabel = v.hasEdited ? "Editat" : "Doar original";

      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(clientLabel)}</td>
          <td>${escapeHtml(typeLabel)}</td>
          <td>${nameSafe}</td>
          <td>${escapeHtml(sizeHuman)}</td>
          <td>${escapeHtml(editedLabel)}</td>
          <td style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" onclick="window.open('/api/videos/${escapeHtml(v.id)}/stream','_blank')">Open original</button>

            ${
              v.hasEdited
                ? `<button class="btn" onclick="window.open('/api/videos/${escapeHtml(v.id)}/stream?edited=1','_blank')">Open editat</button>`
                : ""
            }

            <button class="btn primary" onclick="window.uploadEdited('${escapeHtml(v.id)}')">Upload editat</button>

            <button class="btn danger" onclick="window.deleteVideo('${escapeHtml(v.id)}', '${nameSafe}')">Șterge</button>
          </td>
        </tr>
      `;
    })
    .join("");

  const c = document.getElementById("countLabel");
  if (c) c.textContent = `Total: ${videos.length}`;
}

function applyFilters() {
  const searchEl = document.getElementById("videoSearch");
  const filterEl = document.getElementById("videoClientFilter");

  const q = (searchEl?.value || "").trim().toLowerCase();
  const clientId = (filterEl?.value || "").trim();

  const out = ALL_VIDEOS.filter((v) => {
    if (clientId && v.clientId !== clientId) return false;
    if (!q) return true;

    const name = String(v.originalName || "").toLowerCase();
    const type = getMediaTypeLabel(v).toLowerCase();
    const editStatus = v.hasEdited ? "editat" : "original";
    const c = CLIENTS_MAP.get(v.clientId);
    const uname = String(c?.username || "").toLowerCase();
    const cid = String(v.clientId || "").toLowerCase();

    return (
      name.includes(q) ||
      type.includes(q) ||
      editStatus.includes(q) ||
      uname.includes(q) ||
      cid.includes(q)
    );
  });

  renderVideos(out);
}

function initFiltersUI() {
  const searchEl = document.getElementById("videoSearch");
  const filterEl = document.getElementById("videoClientFilter");
  if (!searchEl || !filterEl) return;

  const searchClone = searchEl.cloneNode(true);
  searchEl.parentNode.replaceChild(searchClone, searchEl);

  const filterClone = filterEl.cloneNode(true);
  filterEl.parentNode.replaceChild(filterClone, filterEl);

  const freshSearch = document.getElementById("videoSearch");
  const freshFilter = document.getElementById("videoClientFilter");

  freshSearch.addEventListener("input", applyFilters);
  freshFilter.addEventListener("change", applyFilters);
}

async function loadClientsIntoUI() {
  const sel = document.getElementById("clientSelect");
  const filterEl = document.getElementById("videoClientFilter");

  const out = await api("/api/clients");
  CLIENTS = Array.isArray(out.clients) ? out.clients : [];
  CLIENTS_MAP = new Map(CLIENTS.map((c) => [c.id, c]));

  if (sel) {
    sel.innerHTML = CLIENTS
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.username)} (${escapeHtml(c.id)})</option>`)
      .join("");
  }

  if (filterEl) {
    const current = filterEl.value || "";
    filterEl.innerHTML = `
      <option value="">Toți clienții</option>
      ${CLIENTS
        .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.username)} (${escapeHtml(c.id)})</option>`)
        .join("")}
    `;
    filterEl.value = current;
  }

  updateStats();
}

async function loadSuggestions() {
  const container = document.getElementById("suggestionsList");
  if (!container) return;

  container.innerHTML = `<div class="small">Se încarcă sugestiile...</div>`;

  try {
    const { suggestions } = await api("/api/suggestions");
    const list = Array.isArray(suggestions) ? suggestions : [];

    if (!list.length) {
      container.innerHTML = `<div class="small">Nu există sugestii trimise încă.</div>`;
      return;
    }

    container.innerHTML = list
      .map((s) => {
        const item = ALL_VIDEOS.find((v) => v.id === s.videoId);
        const itemName = item?.originalName || s.videoId || "Fișier necunoscut";
        const typeLabel = item ? getMediaTypeLabel(item) : "Fișier";
        const created = s.createdAt ? new Date(s.createdAt).toLocaleString("ro-RO") : "";
        const status = s.resolved ? "Rezolvat automat prin upload editat" : "Nerezolvat";

        return `
          <div class="card suggestionCard">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
              <div>
                <div><strong>${escapeHtml(s.username || "Client")}</strong></div>
                <div class="small">${escapeHtml(created)}</div>
              </div>
              <span class="small">${escapeHtml(status)}</span>
            </div>

            <div style="margin-top:10px;">
              <div class="small">${escapeHtml(typeLabel)}:</div>
              <strong>${escapeHtml(itemName)}</strong>
            </div>

            <div style="margin-top:10px;">
              <div class="small">Sugestie:</div>
              <div>${escapeHtml(s.message || "")}</div>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
              ${
                s.videoId
                  ? `<button class="btn" type="button" onclick="window.open('/api/videos/${escapeHtml(s.videoId)}/stream','_blank')">Open original</button>`
                  : ""
              }

              ${
                item?.hasEdited
                  ? `<button class="btn" type="button" onclick="window.open('/api/videos/${escapeHtml(s.videoId)}/stream?edited=1','_blank')">Open editat</button>`
                  : ""
              }

              ${
                !s.resolved && s.videoId
                  ? `<button class="btn primary" type="button" onclick="window.uploadEdited('${escapeHtml(s.videoId)}')">Upload editat</button>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    container.innerHTML = `<div class="small">Eroare: ${escapeHtml(err.message)}</div>`;
  }
}

export async function refreshVideosAdmin() {
  const out = await api("/api/videos");
  ALL_VIDEOS = Array.isArray(out.videos) ? out.videos : [];
  updateStats();
  applyFilters();

  if (SUGGESTIONS_LOADED) {
    await loadSuggestions();
  }
}

export async function initAdmin() {
  const me = await getMeSafe();
  if (!me.user) return goto("login.html");
  if (me.user.role !== "ADMIN") return goto("client.html");

  initFiltersUI();
  await loadClientsIntoUI();
  await refreshVideosAdmin();
}

export async function deleteVideo(id, originalName) {
  const ok = confirm(`Sigur vrei să ștergi fișierul din galerie?\n\n${originalName}`);
  if (!ok) return;

  try {
    const res = await fetch(`/api/videos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Eroare la ștergere");

    await refreshVideosAdmin();
  } catch (err) {
    alert(err.message);
  }
}
window.deleteVideo = deleteVideo;

window.uploadEdited = async function (videoId) {
  const item = ALL_VIDEOS.find((v) => v.id === videoId);
  if (!item) return alert("Fișierul nu a fost găsit.");

  const input = document.createElement("input");
  input.type = "file";
  input.accept = item.type === "image" ? "image/*" : "video/*";

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (item.type === "image" && !isImage) {
      return alert("Pentru o poză originală trebuie încărcată tot o poză editată.");
    }

    if (item.type !== "image" && !isVideo) {
      return alert("Pentru un video original trebuie încărcat tot un video editat.");
    }

    const fd = new FormData();
    fd.append("video", file);

    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/upload-edited`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Eroare upload editat");

      alert("Varianta editată a fost încărcată. Sugestiile pentru acest fișier au fost marcate automat ca rezolvate.");
      await refreshVideosAdmin();
    } catch (err) {
      alert(err.message || "Eroare la upload editat.");
    }
  };

  input.click();
};

export function initUploadAdmin() {
  const uploadForm = document.getElementById("uploadForm");
  if (!uploadForm) return;

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("videoFile");
    const clientSelect = document.getElementById("clientSelect");
    const status = document.getElementById("status");

    const file = fileInput?.files?.[0];
    const clientId = clientSelect?.value;

    if (!file) return alert("Alege o poză sau un video.");

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      return alert("Doar fișiere imagine sau video.");
    }

    if (!clientId) return alert("Alege un client.");

    const fd = new FormData();
    fd.append("video", file);
    fd.append("clientId", clientId);

    if (status) status.textContent = "Se încarcă...";

    try {
      const res = await fetch("/api/videos/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Eroare upload");

      if (status) status.textContent = `Upload OK (${data.method || "?"}) : ${data.video.originalName}`;
      uploadForm.reset();
      if (clientSelect) clientSelect.value = clientId;

      await refreshVideosAdmin();
    } catch (err) {
      if (status) status.textContent = `Eroare: ${err.message}`;
      else alert(err.message);
    }
  });
}

export function initAdminTabs() {
  const buttons = Array.from(document.querySelectorAll(".tabBtn[data-tab]"));
  const panels = Array.from(document.querySelectorAll(".tabPanel"));
  if (!buttons.length || !panels.length) return;

  const setActive = async (tabId) => {
    buttons.forEach((b) => b.classList.toggle("isActive", b.dataset.tab === tabId));
    panels.forEach((p) => p.classList.toggle("isActive", p.id === tabId));

    if (tabId === "tabUsers" && !USERS_LOADED) {
      USERS_LOADED = true;
      const mod = await import("./admin-users.js");
      await mod.initAdminUsers();
    }

    if (tabId === "tabSuggestions") {
      SUGGESTIONS_LOADED = true;
      await loadSuggestions();
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setActive(btn.dataset.tab));
  });

  if (location.hash === "#users") setActive("tabUsers");
  else if (location.hash === "#suggestions") setActive("tabSuggestions");
  else setActive("tabOverview");
}