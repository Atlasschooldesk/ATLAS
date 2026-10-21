/* ATLAS service worker.
   · Shows reminders: the ones ATLAS shows while it's open, and the push
     notifications that arrive when it's closed.
   · Opens ATLAS when you tap one.
   · Keeps the last copy of ATLAS it loaded, so it still opens offline.
   It never sees your desk: that stays in the page and in your account. */
const SHELL = 'atlas-shell-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.indexOf('atlas-shell-') === 0 && k !== SHELL).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

/* Network first, so an update is never held back; the saved copy is only for offline. */
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return;
  const u = new URL(r.url);
  const isApp = u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname);
  if (!isApp) return;
  e.respondWith(fetch(r).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(new URL('./', self.registration.scope).href, copy)).catch(() => { }); }
    return res;
  }).catch(() => caches.match(new URL('./', self.registration.scope).href).then(m => m || Response.error())));
});

self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = { data: { title: 'ATLAS', body: e.data ? e.data.text() : '' } }; }
  const d = (p && (p.data || p.notification)) || p || {};
  const title = d.title || 'ATLAS';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: new URL('icon-192.png', self.registration.scope).href,
    badge: new URL('icon-badge-96.png', self.registration.scope).href,
    tag: d.tag || undefined,
    renotify: false,
    data: { url: d.url || self.registration.scope }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = all.find(c => c.url.indexOf(self.registration.scope) === 0);
    if (mine) return mine.focus();
    return self.clients.openWindow(url);
  })());
});
