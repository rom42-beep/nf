const CACHE_NAME = "notes-de-frais-v3";

const ASSETS = [
    "./",
    "./index.html",
    "./apple-touch-icon.png",
    "https://unpkg.com/jspdf@4.2.1/dist/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"
];

self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(async function(cache) {
            await Promise.allSettled(
                ASSETS.map(function(url) {
                    return cache.add(url);
                })
            );
        })
        .then(function() {
            return self.skipWaiting();
        })
    );
});

self.addEventListener("activate", function(event) {
    event.waitUntil(
        caches.keys()
        .then(function(keys) {
            return Promise.all(
                keys
                .filter(function(key) {
                    return key !== CACHE_NAME;
                })
                .map(function(key) {
                    return caches.delete(key);
                })
            );
        })
        .then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener("fetch", function(event) {
    if (event.request.method !== "GET") {
        return;
    }

    const request = event.request;
    const url = new URL(request.url);

    /*
     * IMPORTANT :
     * Ne jamais mettre en cache les réponses Supabase.
     * La liste des justificatifs doit toujours refléter
     * immédiatement ce qui vient d'être envoyé au cloud.
     */
    if (
        url.hostname.endsWith(".supabase.co")
        || url.hostname.endsWith(".supabase.in")
    ) {
        event.respondWith(fetch(request));
        return;
    }

    /*
     * Navigation : réseau d'abord, cache seulement si hors ligne.
     * Ainsi les mises à jour GitHub Pages apparaissent rapidement.
     */
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
            .then(function(response) {
                const copie = response.clone();

                caches.open(CACHE_NAME)
                .then(function(cache) {
                    cache.put("./index.html", copie);
                });

                return response;
            })
            .catch(function() {
                return caches.match("./index.html")
                    .then(function(cached) {
                        return cached || caches.match("./");
                    });
            })
        );

        return;
    }

    /*
     * Bibliothèques et fichiers statiques :
     * cache d'abord pour conserver le mode hors ligne.
     */
    event.respondWith(
        caches.match(request)
        .then(function(cached) {
            if (cached) {
                return cached;
            }

            return fetch(request)
            .then(function(response) {
                if (
                    response
                    &&
                    (
                        response.ok
                        ||
                        response.type === "opaque"
                    )
                ) {
                    const copie = response.clone();

                    caches.open(CACHE_NAME)
                    .then(function(cache) {
                        cache.put(request, copie);
                    });
                }

                return response;
            });
        })
    );
});
