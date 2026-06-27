"use strict";

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getBotReply(message) {
  const msg = normalizeText(message);

  if (msg.includes("edit") || msg.includes("editat") || msg.includes("editare")) {
    return "Editările sunt trimise de obicei în 7-10 zile lucrătoare. Dacă ai o sugestie pentru un fișier, folosește butonul „Trimite sugestie” din galerie.";
  }

  if (msg.includes("nu am primit") || msg.includes("cand primesc") || msg.includes("cat dureaza")) {
    return "Materialele editate pot dura 7-10 zile lucrătoare, în funcție de complexitate. Verifică periodic galeria pentru versiunea editată.";
  }

  if (msg.includes("poza") || msg.includes("video") || msg.includes("galerie")) {
    return "În Galeria mea poți vedea pozele și videourile încărcate pentru contul tău. Dacă există versiune editată, poți comuta între Original și Editat.";
  }

  if (msg.includes("sugestie") || msg.includes("modificare") || msg.includes("schimba")) {
    return "Pentru sugestii, intră în galerie și apasă butonul „Trimite sugestie” de la poza sau video-ul respectiv.";
  }

  if (msg.includes("parola") || msg.includes("login") || msg.includes("cont")) {
    return "Dacă ai probleme cu autentificarea, verifică username-ul și parola. Dacă problema continuă, contactează administratorul platformei.";
  }

  if (msg.includes("contact") || msg.includes("telefon")) {
    return "Pentru contact, accesează pagina Contact sau discută direct cu administratorul platformei.";
  }

  if (msg.includes("salut") || msg.includes("buna") || msg.includes("hello")) {
    return "Salut! Sunt botul de suport PBCamera. Te pot ajuta cu informații despre galerie, editări, sugestii sau cont.";
  }

  return "Nu sunt sigur că am înțeles. Poți întreba despre galerie, editări, sugestii, cont sau contact.";
}

function addMessage(container, text, type) {
  const msg = document.createElement("div");
  msg.className = `chatMsg ${type}`;
  msg.textContent = text;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

export function initChatbot() {
  if (document.querySelector(".chatbotWidget")) return;

  const widget = document.createElement("div");
  widget.className = "chatbotWidget";

  widget.innerHTML = `
    <button class="chatbotToggle" type="button">💬</button>

    <div class="chatbotPanel">
      <div class="chatbotHeader">
        <div>
          <strong>Suport PBCamera</strong>
          <div class="small">Răspunsuri rapide</div>
        </div>
        <button class="chatbotClose" type="button">×</button>
      </div>

      <div class="chatbotMessages"></div>

      <form class="chatbotForm">
        <input class="chatbotInput" type="text" placeholder="Scrie o întrebare..." autocomplete="off" />
        <button class="btn primary" type="submit">Trimite</button>
      </form>
    </div>
  `;

  document.body.appendChild(widget);

  const toggle = widget.querySelector(".chatbotToggle");
  const panel = widget.querySelector(".chatbotPanel");
  const close = widget.querySelector(".chatbotClose");
  const form = widget.querySelector(".chatbotForm");
  const input = widget.querySelector(".chatbotInput");
  const messages = widget.querySelector(".chatbotMessages");

  addMessage(messages, "Salut! Cu ce te pot ajuta?", "bot");

  toggle.addEventListener("click", () => {
    panel.classList.toggle("isOpen");
    input.focus();
  });

  close.addEventListener("click", () => {
    panel.classList.remove("isOpen");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    addMessage(messages, text, "user");
    input.value = "";

    setTimeout(() => {
      addMessage(messages, getBotReply(text), "bot");
    }, 250);
  });
}