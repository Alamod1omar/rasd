const CACHE_NAME = 'rasd-app-v3';

// Static offline shell assets (only critical icons, fonts, manifest)
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.png',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER intercept or cache backend API calls
  if (url.pathname.startsWith('/api') || url.pathname.includes('/api/v1')) {
    return;
  }

  // 2. NEVER intercept development / HMR assets
  if (
    url.hostname === 'localhost' ||
    url.pathname.includes('webpack') ||
    url.pathname.includes('_next/static/development')
  ) {
    return;
  }

  // 3. Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 4. CRITICAL: NEVER cache or serve stale HTML or page navigations!
  // Always go directly to network with no-store to ensure the startup auth check runs fresh.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => {
        // Offline fallback screen if network is disconnected
        return new Response(
          '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>رَصْد | لا يوجد اتصال</title></head><body style="margin:0;min-height:100vh;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;padding:20px;text-align:center"><div style="max-width:400px"><img src="/logo.png" style="width:72px;height:72px;border-radius:16px;margin-bottom:16px"><h2 style="margin:0 0 8px">لا يوجد اتصال بالإنترنت</h2><p style="color:#94a3b8;font-size:14px;margin-bottom:24px">يرجى التحقق من اتصال الشبكة وإعادة المحاولة.</p><button onclick="location.reload()" style="padding:12px 24px;border-radius:12px;background:#10b981;color:#fff;border:none;font-size:14px;font-weight:bold;cursor:pointer">إعادة المحاولة</button></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );
    return;
  }

  // 5. NEVER cache Next.js dynamic data / RSC payloads
  if (url.pathname.includes('/_next/data/')) {
    return;
  }

  // 6. Cache static CSS and JS chunks (immutable hashed assets)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 7. Stale-While-Revalidate for icons and static brand images
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
