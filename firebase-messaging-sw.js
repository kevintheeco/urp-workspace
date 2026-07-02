/* URP 워크스페이스 — 백그라운드 푸시 알림 (FCM) */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD0ObaK3aKotOjKjtg1MGz_SB4qHX0DhdA",
  authDomain: "yourprofessor-94a2d.firebaseapp.com",
  projectId: "yourprofessor-94a2d",
  storageBucket: "yourprofessor-94a2d.firebasestorage.app",
  messagingSenderId: "307018527457",
  appId: "1:307018527457:web:83c46611055283c427bda0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'URP 알림', {
    body: n.body || '',
    icon: 'assets/forest.jpg',
    badge: 'favicon.svg',
    data: { url: (payload.fcmOptions && payload.fcmOptions.link) || 'https://youareprofessor.github.io/urp-workspace/' }
  });
});

/* 알림 클릭 → 워크스페이스 열기 */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || 'https://youareprofessor.github.io/urp-workspace/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if (c.url.indexOf('urp-workspace') > -1 && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
