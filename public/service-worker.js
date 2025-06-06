
// public/service-worker.js

// This is a placeholder service worker.
// To implement web push notifications, you would:
// 1. Add event listeners for 'push' and 'notificationclick'.
// 2. Handle incoming push messages to display notifications.
// 3. Define actions for when a notification is clicked.

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // event.waitUntil(self.skipWaiting()); // Optional: forces the waiting service worker to become the active service worker.
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  // event.waitUntil(self.clients.claim()); // Optional: allows an active service worker to set itself as the controller for all clients within its scope.
});

self.addEventListener('fetch', (event) => {
  // This service worker doesn't currently intercept fetch requests.
  // You might add caching strategies here for offline functionality.
  // console.log('Service Worker: Fetching', event.request.url);
  // event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  console.log('Service Worker: Push Received.');
  console.log(`Service Worker: Push data: "${event.data ? event.data.text() : 'No data'}"`);

  let title = 'New Notification';
  let options = {
    body: 'Something new happened!',
    icon: '/icons/icon-192x192.png', // Replace with your actual icon path
    badge: '/icons/badge-72x72.png', // Replace with your actual badge path
    data: {
      url: '/', // Default URL to open on click
    },
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      title = pushData.title || title;
      options.body = pushData.body || options.body;
      if (pushData.icon) options.icon = pushData.icon;
      if (pushData.badge) options.badge = pushData.badge;
      if (pushData.data && pushData.data.url) options.data.url = pushData.data.url;
    } catch (e) {
      console.error('Service Worker: Error parsing push data', e);
      // Fallback to text if JSON parsing fails
      options.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click Received.');
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientsArr) => {
      // If a window tab matching the targeted URL already exists, focus that;
      consthadWindowToFocus = clientsArr.some((windowClient) =>
        windowClient.url === urlToOpen ? (windowClient.focus(), true) : false
      );
      //Otherwise, open a new tab to the applicable URL and focus it.
      if (!hadWindowToFocus)
        clients.openWindow(urlToOpen).then((windowClient) => (windowClient ? windowClient.focus() : null));
    })
  );
});

// Note: Ensure you have icons in your /public/icons folder or update paths.
// You'll also need to register this service worker from your client-side code
// and handle push subscription logic (requesting permission, sending subscription to backend).
