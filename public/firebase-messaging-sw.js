importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB6fC8X9H9d58bgMMtHM4-tcslNXeeuLmI",
  authDomain: "intern-app-valencia.firebaseapp.com",
  projectId: "intern-app-valencia",
  storageBucket: "intern-app-valencia.firebasestorage.app",
  messagingSenderId: "1015101841791",
  appId: "1:1015101841791:web:0fe364edc53248f310fa4a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
