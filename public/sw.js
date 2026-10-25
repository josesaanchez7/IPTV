/*
 * Service worker de IPTVFlix: solo guarda la "carcasa" de la app (la página y sus archivos) para
 * que abra sin conexión y arranque rápido. Las listas de canales, los streams y los proxies no
 * pasan por aquí (otro origen, o `/proxy/`): siempre van a la red.
 *
 * Al cambiar este archivo, la versión nueva espera a que la página lo confirme (mensaje
 * SKIP_WAITING) para no recargar a mitad de una reproducción.
 */

const VERSION = 'v1';
const SHELL_CACHE = `iptvflix-shell-${VERSION}`;
const ASSET_CACHE = `iptvflix-assets-${VERSION}`;

const SHELL_FILES = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL_FILES);
      // Los archivos con hash que la página pide al arrancar (JS y CSS), para que la primera
      // visita también funcione sin conexión. Los trozos que se cargan después (reproductor,
      // hls.js) entran en la caché la primera vez que se usan.
      const page = await shell.match('/');
      const html = page ? await page.text() : '';
      const assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])];
      if (assets.length) await (await caches.open(ASSET_CACHE)).addAll(assets);
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      for (const name of await caches.keys()) {
        if (name.startsWith('iptvflix-') && !keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/proxy/')) return;

  if (request.mode === 'navigate') {
    // Con red, siempre la página más nueva; sin red, la última guardada.
    event.respondWith(
      (async () => {
        const shell = await caches.open(SHELL_CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) void shell.put('/', response.clone());
          return response;
        } catch {
          return (await shell.match('/')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Archivos con hash en el nombre: nunca cambian, así que la caché va primero.
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) void cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  if (SHELL_FILES.includes(url.pathname)) {
    // Iconos y manifiesto: lo guardado al instante, y se refresca en segundo plano.
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request);
        const refresh = fetch(request).then((response) => {
          if (response.ok) void cache.put(request, response.clone());
          return response;
        });
        if (cached) {
          refresh.catch(() => {});
          return cached;
        }
        return refresh;
      })(),
    );
  }
});
