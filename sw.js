// Alcyon fonctionne hors ligne : tous les fichiers de l'app sont mis en cache.
// Aucune donnée personnelle ne passe par ici (elles restent dans localStorage).
const CACHE = 'alcyon-v5';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'icon.svg', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
// Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});

// Clic sur un rappel : on ouvre (ou on ramène) l'app sur le bon moment de la journée.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const slot = (e.notification.data && e.notification.data.slot) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { c.postMessage({ slot }); return c.focus(); }
    return self.clients.openWindow('./?slot=' + encodeURIComponent(slot));
  }));
});
