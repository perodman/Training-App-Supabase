// En enkel Service Worker som löser 404-felet
self.addEventListener('install', (event) => {
    console.log('Service Worker installerad');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker aktiverad');
});
