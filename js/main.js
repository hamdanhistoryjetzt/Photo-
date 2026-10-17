import { initUploadButton } from "./cloudinary-upload.js";
import { initGallery } from "./gallery.js";
import { initChat } from "./chat.js";

console.log("[main] app booting", new Date().toISOString());

initUploadButton();
initGallery();
initChat();
