// Service workers run in a separate thread and don't support ES6 module imports natively without a bundler.
// We use importScripts to load the standard compat libraries from the CDN.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyACHtGdXLq9TNZZchfrx46pUQcGb6ndtAI",
  authDomain: "henchies-reboot.firebaseapp.com",
  projectId: "henchies-reboot",
  storageBucket: "henchies-reboot.firebasestorage.app",
  messagingSenderId: "641284877771",
  appId: "1:641284877771:web:0497d79a089e6ca2831a4e"
});

const messaging = firebase.messaging();

function normalizeNotificationTargetUrl(rawUrl, scope = self.registration?.scope || 'https://example.com/') {
  if (!rawUrl) return new URL('game.html', scope).href;
  if (/^https?:\/\//i.test(rawUrl)) return new URL(rawUrl).href;

  const cleanedUrl = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
  const baseUrl = scope.endsWith('/') ? scope : `${scope}/`;
  return new URL(cleanedUrl, baseUrl).href;
}

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background data message ', payload);
  
  // Data-only payload processing allows full custom control
  const data = payload.data || {};
  const notificationTitle = data.title || 'Henchies 2 Alert';
  const notificationOptions = {
    body: data.body || 'It is your turn!',
    data: { ...data, url: normalizeNotificationTargetUrl(data.url) },
    // icon: '/assets/logo.png', // Add this later when you want a custom image!
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = normalizeNotificationTargetUrl(event.notification.data?.url || 'game.html', self.registration.scope);
  const target = new URL(targetUrl);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const client = windowClients.find((c) => {
        try {
          const currentUrl = new URL(c.url);
          return currentUrl.origin === target.origin && currentUrl.pathname === target.pathname;
        } catch (err) {
          return false;
        }
      });

      if (client) {
        return client.focus().then((focusedClient) => {
          if (!focusedClient) return focusedClient;

          try {
            const focusedTarget = new URL(focusedClient.url);
            if (focusedTarget.origin !== target.origin || focusedTarget.pathname !== target.pathname || focusedTarget.hash !== target.hash) {
              return focusedClient.navigate(targetUrl);
            }
          } catch (err) {
            return focusedClient.navigate(targetUrl);
          }

          return focusedClient;
        });
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeNotificationTargetUrl,
  };
}