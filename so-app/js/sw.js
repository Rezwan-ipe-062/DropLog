// ============================================================
// DropLog Service Worker - Offline Support
// ============================================================
const CACHE_NAME = 'droplog-v5';
const urlsToCache = [
    '.',
    'index.html',
    'css/so.css',
    'js/config.js',
    'js/db.js',
    'js/auth.js',
    'js/gps.js',
    'js/route.js',
    'js/delivery.js',
    'js/issue.js',
    'js/complete.js',
    'icon-192.png'
];

// Install - cache core files
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(urlsToCache);
        })
    );
});

// Fetch - network-first for HTML (always get latest), cache-first for assets
self.addEventListener('fetch', function(event) {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then(function(response) {
                return caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, response.clone());
                    return response;
                });
            }).catch(function() {
                return caches.match(event.request);
            })
        );
        return;
    }
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) return response;
            return fetch(event.request).catch(function() {
                return new Response('Offline', { status: 503, statusText: 'Offline' });
            });
        })
    );
});

// Activate - clean old caches, take control immediately
self.addEventListener('activate', function(event) {
    event.waitUntil(
        Promise.all([
            caches.keys().then(function(names) {
                return Promise.all(
                    names.filter(function(name) { return name !== CACHE_NAME; })
                         .map(function(name) { return caches.delete(name); })
                );
            }),
            clients.claim()
        ])
    );
});