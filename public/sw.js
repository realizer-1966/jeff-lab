// jeff-lab service worker - install eligibility only, no cache (edge cache used)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('fetch', (e) => { /* pass-through */ });