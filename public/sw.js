// Service Worker for InfoHub Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'InfoHub Alert';
  const options = {
    body: data.body || 'You have a new alert',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'infohub-alert',
    data: { url: data.url || '/alerts' },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/alerts';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
