/* NodeBeacon notification worker. Deliberately does not cache app assets. */
self.addEventListener('install', event => {
  console.info('[DesktopNotification] Service worker install');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.info('[DesktopNotification] Service worker activate');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', event => {
  console.info('[DesktopNotification] Service worker notification click');
  const notificationData = event.notification.data || {};
  event.notification.close();

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus();
        client.postMessage({ type: 'NODEBEACON_NOTIFICATION_CLICK', ...notificationData });
        return;
      }
    }

    const client = await self.clients.openWindow('/');
    client?.postMessage({ type: 'NODEBEACON_NOTIFICATION_CLICK', ...notificationData });
  })());
});

self.addEventListener('notificationclose', event => {
  console.info('[DesktopNotification] Service worker notification close', {
    tag: event.notification.tag || 'untagged',
  });
});
