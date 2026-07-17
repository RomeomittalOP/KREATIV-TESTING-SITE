const CACHE = 'kreativ-v1';
const SHELL = [
  '/kreativ-workspace',
  '/kreativ-login',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable-192.svg',
  '/icons/icon-maskable-512.svg',
  '/logo.png',
];

// Install — cache app shell immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate — evict old caches, take control of all clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch — stale-while-revalidate for shell; bypass for Firebase/Google
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept Firebase, Google APIs, fonts, or non-GET requests
  if (e.request.method !== 'GET') return;
  if (['firebaseio.com', 'googleapis.com', 'gstatic.com', 'firebasestorage.googleapis.com']
      .some(h => url.hostname.includes(h))) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        // Revalidate in background
        const network = fetch(e.request).then(resp => {
          if (resp.ok && resp.type === 'basic') cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => null);

        // Return cache hit immediately; fall through to network if no cache
        if (cached) {
          network.catch(() => {}); // revalidate silently
          return cached;
        }

        return network.then(resp => {
          if (resp) return resp;
          // Offline fallback: return cached workspace shell for navigations
          if (e.request.mode === 'navigate') {
            return cache.match('/kreativ-workspace') ||
              new Response('<h2 style="font-family:sans-serif;padding:40px;color:#555">You\'re offline — reconnect to use Kreativ.</h2>',
                { headers: { 'Content-Type': 'text/html' } });
          }
          return new Response('', { status: 503 });
        });
      })
    )
  );
});

// Message from client — skip waiting to activate new version immediately
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
