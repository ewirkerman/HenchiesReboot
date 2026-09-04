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

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background data message ', payload);
  
  // Data-only payload processing allows full custom control
  const notificationTitle = payload.data?.title || 'Henchies 2 Alert';
  const notificationOptions = {
    body: payload.data?.body || 'It is your turn!',
    data: payload.data, // Pass the whole data object so the click handler has the dynamic URL
    // icon: '/assets/logo.png', // Add this later when you want a custom image!
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Extract the dynamic URL passed from our Cloud Function
  const targetPath = event.notification.data?.url || "/game.html";
  const targetUrl = new URL(targetPath, self.location.origin).href; 

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if ANY tab is open to our game domain
      const client = windowClients.find(c => c.url.startsWith(self.location.origin) && 'focus' in c);

      if (client) {
        // Focus first, then navigate to the specific room hash
        return client.focus().then(focusedClient => {
          if (focusedClient && focusedClient.url !== targetUrl) {
            return focusedClient.navigate(targetUrl);
          }
          return focusedClient;
        });
      }
      
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});