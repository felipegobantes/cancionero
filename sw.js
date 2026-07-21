/* Service worker del Cancionero.
   Objetivo: que la app abra sin conexión, sin dejarte atrapado en una versión
   vieja mientras sigues iterando el HTML.

   Estrategia:
     · La página (navegación / index.html) va por RED PRIMERO, con la caché
       como respaldo. Así, cuando publiques una versión nueva la ves al
       instante si hay señal, y si no hay señal igual abre la última guardada.
     · Los recursos fijos (iconos, manifest) van por CACHÉ PRIMERO, porque no
       cambian y así la app arranca al toque.

   Al cambiar el HTML, sube el número de VERSION: eso invalida la caché vieja.
*/
const VERSION = 'cancionero-v3.2';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', e=>{
  e.waitUntil((async()=>{
    const cache = await caches.open(VERSION);
    // addAll falla entero si un archivo falta; los agrego uno a uno para que
    // un recurso ausente no impida instalar el service worker.
    await Promise.all(SHELL.map(u=>cache.add(u).catch(()=>{})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // no tocamos recursos externos

  const esPagina = req.mode === 'navigate' || url.pathname.endsWith('.html');

  if(esPagina){
    // red primero
    e.respondWith((async()=>{
      try{
        const fresca = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, fresca.clone());
        return fresca;
      }catch(err){
        const cache = await caches.open(VERSION);
        return (await cache.match(req)) || (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // caché primero para el resto
  e.respondWith((async()=>{
    const cache = await caches.open(VERSION);
    const guardada = await cache.match(req);
    if(guardada) return guardada;
    try{
      const fresca = await fetch(req);
      cache.put(req, fresca.clone());
      return fresca;
    }catch(err){
      return Response.error();
    }
  })());
});
