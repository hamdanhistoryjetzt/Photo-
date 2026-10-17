import { push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { photosRef } from "./firebase.js";
import { CLOUD_NAME, UPLOAD_PRESET } from "./config.js";

const statusEl = document.getElementById("status");
function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

let widget = null;
let pendingSaves = 0;

function getWidget() {
  if (widget) return widget;
  if (!window.cloudinary || typeof window.cloudinary.createUploadWidget !== "function") {
    setStatus("Upload widget failed to load. Check your connection.");
    return null;
  }
  widget = window.cloudinary.createUploadWidget(
    {
      cloudName: CLOUD_NAME,
      uploadPreset: UPLOAD_PRESET,
      sources: ["local", "url", "camera"],
      multiple: true,
      maxFiles: 10,
      clientAllowedFormats: ["image"],
      resourceType: "image"
    },
    handleWidgetEvent
  );
  return widget;
}

function handleWidgetEvent(error, result) {
  if (error) {
    console.error("[cloudinary] widget error:", error);
    setStatus("Upload failed. Please try again.");
    return;
  }
  if (!result || !result.event) return;
  switch (result.event) {
    case "upload-added": setStatus("Uploading…"); break;
    case "success": savePhoto(result.info); break;
    case "queues-end": if (pendingSaves === 0) setStatus("Upload complete."); break;
    case "close": if (pendingSaves === 0) setStatus(""); break;
  }
}

async function savePhoto(info) {
  if (!photosRef) { setStatus("Photo uploaded, but the wall is offline."); return; }
  pendingSaves++;
  setStatus("Saving to the wall…");
  try {
    await push(photosRef, {
      url: info.secure_url,
      publicId: info.public_id,
      width: info.width || null,
      height: info.height || null,
      format: info.format || null,
      createdAt: serverTimestamp(),
      uploadedAt: Date.now()
    });
    setStatus("Photo added to the wall.");
  } catch (err) {
    console.error("[firebase] push failed:", err);
    setStatus("Photo uploaded, but saving to the wall failed.");
  } finally {
    pendingSaves--;
  }
}

export function initUploadButton() {
  const btn = document.getElementById("upload-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const w = getWidget();
    if (w) w.open();
  });
}
