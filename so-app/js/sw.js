// ============================================================
// DropLog Service Worker - Offline Support
// ============================================================
var CACHE_NAME = 'droplog-v4';
var urlsToCache = [
    '.',
    'index.html',
    'css/so.css',
    'js/config.js',
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
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(urlsToCache);
        })
    );
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});

// Activate - clean old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(name) { return name !== CACHE_NAME; })
                     .map(function(name) { return caches.delete(name); })
            );
        })
    );
});