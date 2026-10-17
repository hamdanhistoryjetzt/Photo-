import { onValue, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { photosRef } from "./firebase.js";
import { THUMB_WIDTHS } from "./config.js";

const VERSION = "v4-polling";
const POLL_MS = 3000;

const galleryEl = document.getElementById("gallery");
const emptyEl   = document.getElementById("empty-state");
const cardByKey = new Map();

console.log(`[gallery] ${VERSION} loaded`);

// Version badge in the header — proves you're running the new code
const headerSub = document.querySelector("header .sub");
if (headerSub) {
  const badge = document.createElement("span");
  badge.textContent = " · gallery " + VERSION;
  badge.style.cssText = "font-size:.7rem;opacity:.6;";
  headerSub.appendChild(badge);
}

function withTransform(baseUrl, transform) {
  if (typeof baseUrl !== "string") return baseUrl;
  if (!baseUrl.includes("/image/upload/")) return baseUrl;
  return baseUrl.replace("/image/upload/", `/image/upload/${transform}/`);
}

function thumbUrl(originalUrl, width) {
  return withTransform(originalUrl, `w_${width},c_limit,q_auto,f_auto`);
}

function createCard(key, photo) {
  const card = document.createElement("figure");
  card.className = "card";
  card.dataset.key = key;

  const img = document.createElement("img");
  img.alt = "Photo uploaded to the public wall";
  img.loading = "lazy";
  img.decoding = "async";
  img.src = thumbUrl(photo.url, 500);
  img.srcset = THUMB_WIDTHS.map(w => `${thumbUrl(photo.url, w)} ${w}w`).join(", ");
  img.sizes = "(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 240px";
  if (photo.width && photo.height) { img.width = photo.width; img.height = photo.height; }
  img.addEventListener("error", () => card.classList.add("is-broken"), { once: true });

  const caption = document.createElement("figcaption");
  const link = document.createElement("a");
  link.href = photo.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open original";
  caption.appendChild(link);

  card.append(img, caption);
  return card;
}

function renderGallery(entries, reason) {
  try {
    const incomingKeys = new Set(entries.map(e => e.key));

    // Remove cards that no longer exist
    for (const [key, el] of cardByKey) {
      if (!incomingKeys.has(key)) { el.remove(); cardByKey.delete(key); }
    }

    emptyEl.hidden = entries.length > 0;

    // Insert/reorder without recreating
    entries.forEach((entry, index) => {
      let card = cardByKey.get(entry.key);
      if (!card) {
        card = createCard(entry.key, entry.value);
        cardByKey.set(entry.key, card);
      }
      const currentAtSlot = galleryEl.children[index] || null;
      if (currentAtSlot !== card) galleryEl.insertBefore(card, currentAtSlot);
    });

    console.log(`[gallery] render (${reason}):`, entries.length, "photos",
                entries.map(e => e.key.slice(-6)));
  } catch (err) {
    console.error("[gallery] render threw:", err);
  }
}

// Live listener (may die on flaky networks)
onValue(
  photosRef,
  (snapshot) => {
    try {
      const entries = [];
      snapshot.forEach(child => entries.push({ key: child.key, value: child.val() }));
      entries.reverse();
      renderGallery(entries, "onValue");
    } catch (err) {
      console.error("[gallery] listener handler threw:", err);
    }
  },
  (err) => console.error("[gallery] listener error:", err)
);

// Polling fallback — immune to dead WebSockets
let polling = false;
async function forceRead(reason) {
  if (polling && reason === "poll") return;
  try {
    if (reason === "poll") polling = true;
    const snap = await get(photosRef);
    const entries = [];
    snap.forEach(child => entries.push({ key: child.key, value: child.val() }));
    entries.reverse();
    renderGallery(entries, reason);
  } catch (err) {
    console.error(`[gallery] forceRead(${reason}) failed:`, err);
  } finally {
    if (reason === "poll") polling = false;
  }
}

forceRead("initial");
setInterval(() => forceRead("poll"), POLL_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") forceRead("visibility");
});
