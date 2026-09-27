// frontend/src/sw.js
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

// ============================================================
// Web Push — приходит от бэкенда через web-push
// ============================================================
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Новое сообщение', body: event.data?.text() || '' };
  }

  const title = data.title || 'Новое сообщение';
  const options = {
    body: data.body || '',
    icon: '/img/favicon.png',
    badge: '/img/favicon.png',
    data: { url: data.url || '/', messageId: data.messageId },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================
// Клик по уведомлению
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) {
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ============================================================
// Обновление подписки при смене endpoint
// ============================================================
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) =>
        fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subscription }),
        })
      )
  );
});