const CACHE = "tvguide-v1";

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => {
            return cache.addAll([
                "./",
                "./index.html",
                "./styles.css",
                "./app.js",
                "./detail.html",
                "./detail.js",
                "./xmltv_tnt.xml"
            ]);
        })
    );
});

self.addEventListener("fetch", event => {
    const req = event.request;

    // Cache-first for images
    if (req.destination === "image") {
        event.respondWith(
            caches.match(req).then(cached => {
                return (
                    cached ||
                    fetch(req).then(res => {
                        const copy = res.clone();
                        caches.open(CACHE).then(cache => cache.put(req, copy));
                        return res;
                    })
                );
            })
        );
        return;
    }

    event.respondWith(
        caches.match(req).then(cached => cached || fetch(req))
    );
});
