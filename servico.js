// Serviço mínimo: permite instalar no telemóvel e vai sempre buscar a versão mais recente
// (só usa a cópia guardada quando não há rede).
const CACHE = 'texugo-plataforma-v4';
const BASE = ['./', 'index.html', 'estilos.css', 'app.js', 'config.js', 'modo-teste.js', 'logo.png', 'texugo.png', 'icone-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
