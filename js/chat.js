import { push, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db, chatQuery } from "./firebase.js";
import { CHAT_PATH, CHAT_RATE_LIMIT_MS } from "./config.js";

const statusEl = document.getElementById("status");
function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

export function initChat() {
  const messagesEl = document.getElementById("chat-messages");
  const emptyEl    = document.getElementById("chat-empty");
  const countEl    = document.getElementById("chat-count");
  const form       = document.getElementById("chat-form");
  const nameInput  = document.getElementById("chat-name");
  const textInput  = document.getElementById("chat-text");
  const sendBtn    = document.getElementById("chat-send");

  const CLIENT_ID = (() => {
    try {
      const existing = localStorage.getItem("chat_client_id");
      if (existing) return existing;
      const id = (crypto.randomUUID && crypto.randomUUID()) ||
                 (Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem("chat_client_id", id);
      return id;
    } catch {
      return "anon-" + Math.random().toString(36).slice(2);
    }
  })();

  try {
    const saved = localStorage.getItem("chat_name");
    if (saved) nameInput.value = saved;
  } catch {}

  let lastSend = 0;
  let sending = false;

  function formatTime(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function renderChat(messages) {
    const nearBottom =
      messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

    for (const child of Array.from(messagesEl.children)) {
      if (child !== emptyEl) child.remove();
    }

    emptyEl.hidden = messages.length > 0;
    countEl.textContent = messages.length
      ? `${messages.length} message${messages.length === 1 ? "" : "s"}`
      : "";

    for (const msg of messages) {
      const row = document.createElement("div");
      row.className = "chat-message";
      if (msg.clientId && msg.clientId === CLIENT_ID) row.classList.add("is-own");

      const meta = document.createElement("div");
      meta.className = "chat-message-meta";

      const name = document.createElement("span");
      name.className = "chat-name";
      name.textContent = String(msg.name || "Anonymous").slice(0, 24);
      meta.appendChild(name);

      if (row.classList.contains("is-own")) {
        const you = document.createElement("span");
        you.className = "chat-you";
        you.textContent = "You";
        meta.appendChild(you);
      }

      const time = document.createElement("span");
      time.className = "chat-time";
      time.textContent = formatTime(msg.createdAt || msg.clientSentAt || Date.now());
      meta.appendChild(time);

      const text = document.createElement("div");
      text.className = "chat-text";
      text.textContent = String(msg.text || "");

      row.append(meta, text);
      messagesEl.appendChild(row);
    }

    if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  onValue(
    chatQuery,
    (snapshot) => {
      const messages = [];
      snapshot.forEach(child => messages.push(child.val() || {}));
      renderChat(messages);
    },
    (err) => console.error("[chat] listener error:", err)
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending || !db) return;

    const text = textInput.value.trim();
    if (!text) return;

    const now = Date.now();
    if (now - lastSend < CHAT_RATE_LIMIT_MS) {
      setStatus("Slow down a little.");
      return;
    }

    const rawName = nameInput.value.trim();
    const name = rawName ? rawName.slice(0, 24) : "Anonymous";
    try { localStorage.setItem("chat_name", name); } catch {}

    sending = true;
    sendBtn.disabled = true;
    lastSend = now;

    try {
      await push(db ? (await import("./firebase.js")).db && undefined : null, {}); // placeholder — replaced below
    } catch {}
  });
}
