/* Service worker til El-oversigtsappen: appen virker uden net, når den har været åbnet én gang.
   VERSION skal være lig APP_VERSION i js/data.js og ?v= i index.html. Røgtesten kontrollerer det.
   Plan: docs/planer/2026-11-16-offline.md */
const VERSION = '10.31.0';
const CACHE = 'el-oversigt-' + VERSION, FONTE = 'el-oversigt-fonte';
const V = '?v=' + VERSION;
const SKAL = ['./', 'index.html', 'manifest.webmanifest', 'ikoner/ikon-192.png', 'ikoner/ikon-512.png', 'ikoner/ikon.svg', 'ikoner/apple-touch-icon.png',
  'css/app.css' + V, 'css/tailwind.css' + V,
  'js/data.js' + V, 'js/beregning.js' + V, 'js/diagram.js' + V, 'js/lagring.js' + V, 'js/historik.js' + V, 'js/billeder.js' + V, 'js/brand.js' + V, 'js/aflevering.js' + V, 'js/import.js' + V, 'js/app.js' + V,
  'https://cdnjs.cloudflare.com/ajax/libs/alpinejs/3.14.1/cdn.min.js'];
/* Appens egne adresser i forhold til scope. Alt andet på samme origin hører til andre apps og håndteres ikke. */
const EGNE = /^(index\.html|manifest\.webmanifest|sw\.js|(css|js|ikoner)\/[^/]+)?$/;

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(SKAL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FONTE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const r = ev.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  /* Andre apps på samme origin (fx Elskolen under /elskole/): service workerens scope er hele sitet, men den må kun røre sine egne filer.
     Ellers ville en side fra en anden app blive gemt som denne apps index.html. Plan: docs/planer/2026-11-22-sw-egne-adresser.md */
  if (u.origin === self.location.origin) {
    const base = new URL(self.registration.scope).pathname, sti = u.pathname.startsWith(base) ? u.pathname.slice(base.length) : null;
    if (sti === null || !EGNE.test(sti)) return;
  }
  /* Synkronisering går altid direkte til GitHub og gemmes aldrig. */
  if (/(^|\.)github(usercontent)?\.com$/.test(u.hostname)) return;
  /* Sider: net først, så man online altid får nyeste version. Offline bruges den gemte. */
  if (r.mode === 'navigate') {
    ev.respondWith(fetch(r).then(svar => { if (svar.ok) { const k = svar.clone(); caches.open(CACHE).then(c => c.put('index.html', k)); } return svar; })
      .catch(() => caches.match('index.html', { cacheName: CACHE }).then(s => s || caches.match('./'))));
    return;
  }
  /* Skrifttyper: gemmes, når de hentes første gang. */
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    ev.respondWith(caches.open(FONTE).then(c => c.match(r).then(s => s || fetch(r).then(svar => { c.put(r, svar.clone()); return svar; }))));
    return;
  }
  /* App-filer med ?v= og Alpine: cache først. */
  ev.respondWith(caches.match(r).then(s => s || fetch(r)));
});
