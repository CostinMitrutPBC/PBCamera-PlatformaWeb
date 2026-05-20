// frontend/app.js
"use strict";

// ================= Helpers =================
async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Eroare API");
  return data;
}

async function getMeSafe() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    return await res.json();
  } catch {
    return { user: null };
  }
}

function goto(page) {
  window.location.href = page;
}

function isPage(name) {
  return location.pathname.toLowerCase().endsWith(name.toLowerCase());
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ================= Global NAV (Login/Logout + Videos/Dashboard smart) =================
async function goToVideosSmart() {
  const me = await getMeSafe();
  if (!me.user) return goto("login.html");
  if (me.user.role === "ADMIN") return goto("admin.html");
  return goto("client.html");
}

async function doLogout() {
  try {
    await api("/api/logout", { method: "POST" });
  } catch {}
  goto("login.html");
}

async function initGlobalNav() {
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

    // Videos/Dashboard button
    if (videosNavBtn) {
      videosNavBtn.textContent = role === "ADMIN" ? "Dashboard" : "Videoclipurile mele";

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

    // Auth button Login/Logout
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

    // Separate logout button
    if (logoutBtn) {
      const clone = logoutBtn.cloneNode(true);
      logoutBtn.parentNode.replaceChild(clone, logoutBtn);
      clone.addEventListener("click", doLogout);
    }
  } catch (e) {
    console.error("initGlobalNav error:", e);
  }
}

// ================= LOGIN =================
function initLogin() {
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

// ================= REGISTER =================
function initRegister() {
  const registerForm = document.getElementById("registerForm");
  if (!registerForm) return;

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("regUsername")?.value?.trim() || "";
    const email = document.getElementById("regEmail")?.value?.trim() || "";
    const password = document.getElementById("regPassword")?.value || "";
    const status = document.getElementById("regStatus");

    if (status) status.textContent = "Se creează contul...";

    try {
      await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });

      if (status) status.textContent = "Cont creat! Te poți loga acum.";
      registerForm.reset();
    } catch (err) {
      if (status) status.textContent = `Eroare: ${err.message}`;
      else alert(err.message);
    }
  });
}

// ================= ADMIN: upload + list =================
async function refreshVideosAdmin() {
  const tableBody = document.getElementById("videosTbody");
  if (!tableBody) return;

  const { videos } = await api("/api/videos");

  tableBody.innerHTML = videos
    .map((v) => {
      const nameSafe = escapeHtml(v.originalName);
      const date = new Date(v.uploadedAt).toLocaleString("ro-RO");
      const sizeMb = Math.round(v.size / 1024 / 1024);

      return `
        <tr>
          <td>${date}</td>
          <td>${escapeHtml(v.clientId)}</td>
          <td>${nameSafe}</td>
          <td>${sizeMb} MB</td>
          <td style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" onclick="window.open('/api/videos/${escapeHtml(v.id)}/stream','_blank')">Open stream</button>
            <button class="btn" onclick="window.deleteVideo('${escapeHtml(v.id)}', '${nameSafe}')">Șterge</button>
          </td>
        </tr>
      `;
    })
    .join("");

  const c = document.getElementById("countLabel");
  if (c) c.textContent = `Total: ${videos.length}`;
}

async function initAdmin() {
  const me = await getMeSafe();
  if (!me.user) return goto("login.html");
  if (me.user.role !== "ADMIN") return goto("client.html");

  const sel = document.getElementById("clientSelect");
  if (sel) {
    const { clients } = await api("/api/clients");
    sel.innerHTML = clients
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.username)} (${escapeHtml(c.id)})</option>`)
      .join("");
  }

  await refreshVideosAdmin();
}

async function deleteVideo(id, originalName) {
  const ok = confirm(`Sigur vrei să ștergi video-ul?\n\n${originalName}`);
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

function initUploadAdmin() {
  const uploadForm = document.getElementById("uploadForm");
  if (!uploadForm) return;

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("videoFile");
    const clientSelect = document.getElementById("clientSelect");
    const status = document.getElementById("status");

    const file = fileInput?.files?.[0];
    const clientId = clientSelect?.value;

    if (!file) return alert("Alege un fișier video.");
    if (!file.type.startsWith("video/")) return alert("Doar fișiere video.");
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

// ================= ADMIN USERS =================
async function initAdminUsers() {
  const me = await getMeSafe();
  if (!me.user) return goto("login.html");
  if (me.user.role !== "ADMIN") return goto("client.html");

  const { users } = await api("/api/users");
  const tbody = document.getElementById("usersTbody");
  const cnt = document.getElementById("usersCount");

  if (cnt) cnt.textContent = `Total conturi: ${users.length}`;

  if (tbody) {
    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.id)}</td>
        <td>${escapeHtml(u.username || "")}</td>
        <td>${escapeHtml(u.email || "")}</td>
        <td>${escapeHtml(u.role)}</td>
        <td>${u.createdAt ? new Date(u.createdAt).toLocaleString("ro-RO") : ""}</td>
      </tr>
    `
      )
      .join("");
  }
}

// ================= CLIENT (restore videos list + custom player) =================
function setupVideoFrameClasses() {
  document.querySelectorAll(".playerFrame video").forEach((video) => {
    const frame = video.closest(".playerFrame");
    if (!frame) return;

    const recalc = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      frame.classList.remove("portrait", "landscape");
      frame.classList.add(vh > vw ? "portrait" : "landscape");
    };

    video.addEventListener("loadedmetadata", recalc);
    recalc();
  });
}

function attachCustomControls(frame) {
  const video = frame.querySelector("video");
  const playBtn = frame.querySelector(".playBtn");
  const seek = frame.querySelector(".seekRange");
  const vol = frame.querySelector(".volumeRange");
  const time = frame.querySelector(".ctrlTime");
  const volIcon = frame.querySelector(".ctrlVolumeIcon");

  if (!video || !playBtn || !seek || !vol || !time || !volIcon) return;

  // no native controls => no fullscreen
  video.controls = false;
  video.playsInline = true;

  playBtn.textContent = "▶";
  time.textContent = "0:00 / 0:00";
  seek.value = "0";
  if (!Number.isFinite(video.volume)) video.volume = 1;
  vol.value = String(video.volume);
  volIcon.textContent = video.volume === 0 || video.muted ? "🔇" : "🔊";

  const updateUI = () => {
    time.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      seek.value = String((video.currentTime / video.duration) * 1000);
    }
  };

  playBtn.addEventListener("click", () => {
    if (video.paused) video.play();
    else video.pause();
  });

  video.addEventListener("play", () => (playBtn.textContent = "⏸"));
  video.addEventListener("pause", () => (playBtn.textContent = "▶"));

  seek.addEventListener("input", () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const p = Number(seek.value) / 1000;
    video.currentTime = p * video.duration;
  });

  vol.addEventListener("input", () => {
    const v = Math.min(1, Math.max(0, Number(vol.value)));
    video.volume = v;
    video.muted = v === 0;
    volIcon.textContent = v === 0 ? "🔇" : "🔊";
  });

  volIcon.addEventListener("click", () => {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
      vol.value = String(video.volume);
      volIcon.textContent = "🔊";
    } else {
      video.muted = true;
      volIcon.textContent = "🔇";
    }
  });

  video.addEventListener("timeupdate", updateUI);
  video.addEventListener("loadedmetadata", updateUI);
}

function initCustomPlayers() {
  document.querySelectorAll(".playerFrame[data-player]").forEach((frame) => attachCustomControls(frame));
}

async function initClient() {
  const me = await getMeSafe();
  if (!me.user) return goto("login.html");
  if (me.user.role === "ADMIN") return goto("admin.html");

  const list = document.getElementById("videoList");
  if (!list) return;

  const { videos } = await api("/api/videos");

  if (!videos.length) {
    list.innerHTML = `<div class="small">Nu există videouri pentru contul tău încă.</div>`;
    return;
  }

  list.innerHTML = videos
    .map(
      (v) => `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <div>
            <div><strong>${escapeHtml(v.originalName)}</strong></div>
            <div class="small">${new Date(v.uploadedAt).toLocaleString("ro-RO")}</div>
          </div>
        </div>

        <div class="playerFrame" data-player>
          <video preload="metadata" playsinline src="/api/videos/${escapeHtml(v.id)}/stream"></video>

          <div class="controlsBar">
            <button class="ctrlBtn playBtn" type="button">▶</button>
            <input class="ctrlRange seekRange" type="range" min="0" max="1000" value="0" step="1" />
            <div class="ctrlVolume">
              <span class="ctrlVolumeIcon" title="Mute/unmute">🔊</span>
              <input class="ctrlRange volumeRange" type="range" min="0" max="1" step="0.01" value="1" />
            </div>
            <div class="ctrlTime">0:00 / 0:00</div>
          </div>
        </div>
      </div>
    `
    )
    .join("");

  initCustomPlayers();
  setupVideoFrameClasses();
}

// ================= BOOT =================
(async function boot() {
  await initGlobalNav();

  if (isPage("login.html")) initLogin();
  if (isPage("register.html")) initRegister();

  if (isPage("admin.html")) {
    initUploadAdmin();
    initAdmin();
  }
  if (isPage("admin-users.html")) initAdminUsers();
  if (isPage("client.html")) initClient();
})();
