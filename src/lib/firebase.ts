import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use initializeFirestore with settings to bypass aggressive ad-blockers
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Forces HTTP instead of WebSockets
});

const storage = getStorage(app);

// Messaging is only supported in browser environments with Service Worker support
const messaging = typeof window !== "undefined" ? isSupported().then(yes => yes ? getMessaging(app) : null) : Promise.resolve(null);

export { auth, db, storage, messaging };
