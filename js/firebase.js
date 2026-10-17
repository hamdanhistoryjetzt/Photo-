import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig, DB_PATH, CHAT_PATH, CHAT_LIMIT } from "./config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const photosRef = ref(db, DB_PATH);
export const chatQuery = query(ref(db, CHAT_PATH), limitToLast(CHAT_LIMIT));
