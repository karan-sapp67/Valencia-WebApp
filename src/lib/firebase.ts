import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyB6fC8X9H9d58bgMMtHM4-tcslNXeeuLmI",
  authDomain: "intern-app-valencia.firebaseapp.com",
  projectId: "intern-app-valencia",
  storageBucket: "intern-app-valencia.firebasestorage.app",
  messagingSenderId: "1015101841791",
  appId: "1:1015101841791:web:0fe364edc53248f310fa4a"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Messaging is only supported in browser environments with Service Worker support
const messaging = typeof window !== "undefined" ? isSupported().then(yes => yes ? getMessaging(app) : null) : Promise.resolve(null);

export { auth, db, storage, messaging };
