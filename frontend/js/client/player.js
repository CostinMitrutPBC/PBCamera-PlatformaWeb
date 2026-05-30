"use strict";

import { api, getMeSafe } from "../core/api.js";
import { goto, escapeHtml, fmtTime } from "../core/utils.js";

function isImage(item) {
  return item.type === "image" || String(item.mime || "").startsWith("image/");
}

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

function openSuggestionBox(videoId, videoName) {
  const existing = document.querySelector(".suggestionOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "suggestionOverlay";

  overlay.innerHTML = `
    <div class="suggestionBox">
      <div class="suggestionHeader">
        <div>
          <strong>Trimite sugestie</strong>
          <div class="small">${escapeHtml(videoName)}</div>
        </div>
        <button class="btn suggestionClose" type="button">×</button>
      </div>

      <textarea class="input suggestionTextarea" placeholder="Scrie aici sugestia ta..." rows="5"></textarea>

      <div class="suggestionActions">
        <button class="btn" type="button" data-cancel>Anulează</button>
        <button class="btn primary" type="button" data-send>Trimite</button>
      </div>

      <div class="small suggestionStatus"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay.querySelector(".suggestionClose").addEventListener("click", close);
  overlay.querySelector("[data-cancel]").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const textarea = overlay.querySelector(".suggestionTextarea");
  const status = overlay.querySelector(".suggestionStatus");
  const sendBtn = overlay.querySelector("[data-send]");

  textarea.focus();

  sendBtn.addEventListener("click", async () => {
    const message = textarea.value.trim();

    if (!message) {
      status.textContent = "Scrie o sugestie înainte de trimitere.";
      return;
    }

    try {
      sendBtn.disabled = true;
      status.textContent = "Se trimite...";

      await api("/api/suggestions", {
        method: "POST",
        body: JSON.stringify({ videoId, message }),
      });

      status.textContent = "Sugestia a fost trimisă către admin.";
      setTimeout(close, 800);
    } catch (err) {
      sendBtn.disabled = false;
      status.textContent = err.message || "Eroare la trimiterea sugestiei.";
    }
  });
}

function initSuggestionButtons() {
  document.querySelectorAll(".suggestionBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const videoId = btn.getAttribute("data-video-id");
      const videoName = btn.getAttribute("data-video-name") || "Fișier";
      openSuggestionBox(videoId, videoName);
    });
  });
}

function setActiveVersionButtons(container, mode) {
  const switchEl = container.querySelector("[data-switch]");
  if (!switchEl) return;

  switchEl.dataset.active = mode;

  switchEl.querySelectorAll(".versionOption").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.version === mode);
  });
}

function initVersionSwitches() {
  document.querySelectorAll("[data-gallery-item]").forEach((card) => {
    const switchEl = card.querySelector("[data-switch]");
    const media = card.querySelector("[data-media-preview]");

    if (!switchEl || !media) return;

    const originalSrc = media.getAttribute("data-original-src");
    const editedSrc = media.getAttribute("data-edited-src");

    let currentMode = "original";

    const changeVersion = () => {
      currentMode = currentMode === "original" ? "edited" : "original";

      const nextSrc = currentMode === "edited" ? editedSrc : originalSrc;

      media.classList.remove("mediaReveal");
      void media.offsetWidth;
      media.classList.add("mediaReveal");

      setTimeout(() => {
        media.src = nextSrc;

        if (media.tagName.toLowerCase() === "video") {
          media.load();
        }

        setActiveVersionButtons(card, currentMode);
      }, 120);
    };

    switchEl.addEventListener("click", changeVersion);

    setActiveVersionButtons(card, "original");
  });
}

function renderMediaPreview(v) {
  const id = escapeHtml(v.id);
  const name = escapeHtml(v.originalName);
  const originalSrc = `/api/videos/${id}/stream`;
  const editedSrc = `/api/videos/${id}/stream?edited=1`;

  if (isImage(v)) {
    return `
      <div class="galleryImageFrame">
        <img
          src="${originalSrc}"
          data-media-preview
          data-original-src="${originalSrc}"
          data-edited-src="${editedSrc}"
          alt="${name}"
          class="galleryImage"
        />
      </div>
    `;
  }

  return `
    <div class="playerFrame" data-player>
      <video
        preload="metadata"
        playsinline
        src="${originalSrc}"
        data-media-preview
        data-original-src="${originalSrc}"
        data-edited-src="${editedSrc}"
      ></video>

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
  `;
}

function renderVersionSwitch(v) {
  if (!v.hasEdited) {
    return `
      <div style="display:flex; justify-content:center; margin-top:12px;">
        <span class="small">Momentan nu există versiune editată.</span>
      </div>
    `;
  }

  return `
    <div class="versionSwitchFancy" data-switch data-active="original">
      <button class="versionOption active" type="button" data-version="original">Original</button>
      <button class="versionOption" type="button" data-version="edited">Editat</button>
      <span class="versionThumb"></span>
    </div>
  `;
}

function renderMediaItem(v) {
  const name = escapeHtml(v.originalName);
  const date = new Date(v.uploadedAt).toLocaleString("ro-RO");
  const typeLabel = isImage(v) ? "Poză" : "Video";
  const editedBadge = v.hasEdited ? "Editat disponibil" : "Doar original";

  return `
    <div class="card" style="margin-bottom:12px;" data-gallery-item>
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
        <div>
          <div><strong>${name}</strong></div>
          <div class="small">${date}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="small">${escapeHtml(typeLabel)}</span>
          <span class="small">${escapeHtml(editedBadge)}</span>
        </div>
      </div>

      ${renderMediaPreview(v)}
      ${renderVersionSwitch(v)}

      <div style="display:flex; justify-content:center; margin-top:12px;">
        <button
          class="btn suggestionBtn"
          type="button"
          data-video-id="${escapeHtml(v.id)}"
          data-video-name="${name}"
        >
          Trimite sugestie
        </button>
      </div>
    </div>
  `;
}

export async function initClient() {
  const me = await getMeSafe();
  if (!me.user) return goto("login.html");
  if (me.user.role === "ADMIN") return goto("admin.html");

  const list = document.getElementById("videoList");
  if (!list) return;

  const { videos } = await api("/api/videos");

  if (!videos.length) {
    list.innerHTML = `<div class="small">Nu există fișiere în galeria ta încă.</div>`;
    return;
  }

  list.innerHTML = videos.map(renderMediaItem).join("");

  initCustomPlayers();
  setupVideoFrameClasses();
  initVersionSwitches();
  initSuggestionButtons();
}