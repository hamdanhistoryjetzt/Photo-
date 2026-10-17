import { push, onValue, serverTimestamp, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db, chatQuery } from "./firebase.js";
import { CHAT_PATH, CHAT_RATE_LIMIT_MS } from "./config.js";

export function initChat() {
  const messagesEl = document.getElementById("chat-messages");
  const emptyEl    = document.getElementById("chat-empty");
  const countEl    = document.getElementById("chat-count");
  const statusEl   = document.getElementById("chat-status");
  const form       = document.getElementById("chat-form");
  const nameInput  = document.getElementById("chat-name");
  const textInput  = document.getElementById("chat-text");
  const sendBtn    = document.getElementById("chat-send");

  // Visible status next to the chat (with console fallback)
  const statusFn = (msg, ms = 4000) => {
    console.log("[chat-status]", msg || "(clear)");
    if (!statusEl) return;
    statusEl.textContent = msg;
    if (msg) setTimeout(() => {
      if (statusEl.textContent === msg) statusEl.textContent = "";
    }, ms);
  };

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
  let sendingTimeout = null;

  // Track Firebase connection so we know if the listener is even alive
  onValue(ref(db, ".info/connected"), (snap) => {
    const connected = snap.val() === true;
    console.log("[chat] connected:", connected);
    if (!connected) statusFn("Reconnecting to chat…", 8000);
  });

  function formatTime(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function renderChat(messages) {
    console.log("[chat] renderChat:", messages.length, "messages");
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

  // Live listener
  onValue(
    chatQuery,
    (snapshot) => {
      const messages = [];
      snapshot.forEach(child => messages.push(child.val() || {}));
      renderChat(messages);
    },
    (err) => {
      console.error("[chat] listener error:", err);
      statusFn("Chat error: " + (err?.message || "unknown"), 8000);
    }
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("[chat] submit attempt:", {
      sending, lastSend, now: Date.now(),
      buttonDisabled: sendBtn.disabled,
      text: textInput.value
    });

    if (sending) { statusFn("Still sending — please wait…"); return; }

    const text = textInput.value.trim();
    if (!text) { statusFn("Type a message first."); return; }

    const now = Date.now();
    if (now - lastSend < CHAT_RATE_LIMIT_MS) {
      const wait = ((CHAT_RATE_LIMIT_MS - (now - lastSend)) / 1000).toFixed(1);
      statusFn(`Please wait ${wait}s before sending again.`);
      return;
    }

    const rawName = nameInput.value.trim();
    const name = rawName ? rawName.slice(0, 24) : "Anonymous";
    try { localStorage.setItem("chat_name", name); } catch {}

    sending = true;
    sendBtn.disabled = true;
    const originalLabel = sendBtn.textContent;
    sendBtn.textContent = "Sending…";
    lastSend = now;
    statusFn("Sending…", 12000);

    // Safety net: never let the form lock forever
    sendingTimeout = setTimeout(() => {
      if (sending) {
        console.warn("[chat] push >12s — force-unlocking");
        sending = false;
        sendBtn.disabled = false;
        sendBtn.textContent = originalLabel;
        statusFn("Send timed out. Check your connection.", 8000);
      }
    }, 12000);

    try {
      const result = await push(ref(db, CHAT_PATH), {
        name,
        text: text.slice(0, 500),
        clientId: CLIENT_ID,
        createdAt: serverTimestamp(),
        clientSentAt: now
      });
      console.log("[chat] push success, key:", result.key);

      textInput.value = "";
      textInput.focus();

      // Verify the message actually landed and force-render it
      try {
        const snap = await get(chatQuery);
        const msgs = [];
        snap.forEach(c => msgs.push(c.val() || {}));
        console.log("[chat] post-push read:", msgs.length, "messages in DB");
        renderChat(msgs);
      } catch (readErr) {
        console.error("[chat] post-push read failed:", readErr);
      }

      messagesEl.scrollTop = messagesEl.scrollHeight;
      statusFn("Sent.");
    } catch (err) {
      console.error("[chat] push failed:", err);
      statusFn("Failed: " + (err?.message || "unknown"), 8000);
    } finally {
      clearTimeout(sendingTimeout);
      sending = false;
      sendBtn.disabled = false;
      sendBtn.textContent = originalLabel;
    }
  });
}
