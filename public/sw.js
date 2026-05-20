/* Service Worker for News & Weather App */
const CACHE_NAME = 'news-weather-app-v2';
const BASE_PATH = './';

const PRECACHE_URLS = [
    BASE_PATH,
    `${BASE_PATH}index.html`,
    `${BASE_PATH}vite.svg`,
    `${BASE_PATH}manifest.json`
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(Promise.all([
        clients.claim(),
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames.map((cacheName) => {
                if (cacheName !== CACHE_NAME) {
                    return caches.delete(cacheName);
                }
                return Promise.resolve();
            })
        ))
    ]));
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Do not hijack third-party requests. Let the browser handle them directly.
    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.method !== 'GET') {
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
            const response = await fetch(request);
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        } catch {
            const cached = await cache.match(request);
            if (cached) {
                return cached;
            }

            if (request.mode === 'navigate') {
                const fallback = await cache.match(`${BASE_PATH}index.html`);
                if (fallback) return fallback;
            }

            return new Response('Offline', {
                status: 503,
                statusText: 'Offline'
            });
        }
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
                    client.postMessage({ type: 'NOTIFICATION_CLICK', action: event.action });
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(BASE_PATH);
            }
            return null;
        })
    );
});
