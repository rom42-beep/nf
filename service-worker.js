const CACHE_NAME = "notes-de-frais-v6-upload-octets";

const ASSETS = [
    "./",
    "./index.html",
    "./apple-touch-icon.png",

    "https://unpkg.com/jspdf@4.2.1/dist/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
    "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",

    /* OCR : moteur, worker, coeur WebAssembly et langue française. */
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js",
    "https://tessdata.projectnaptha.com/4.0.0_fast/fra.traineddata.gz"
];

async function mettreEnCache(cache, url) {
    try {
        const requete = new Request(url, { mode: "cors", cache: "reload" });
        const reponse = await fetch(requete);
        if (!reponse || (!reponse.ok && reponse.type !== "opaque")) {
            throw new Error("Réponse HTTP non valide");
        }
        await cache.put(url, reponse.clone());
    } catch (erreur) {
        console.warn("Mise en cache différée :", url, erreur);
    }
}

self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(function(cache) {
            return Promise.allSettled(
                ASSETS.map(function(url) {
                    return mettreEnCache(cache, url);
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
    if (event.request.method !== "GET") return;

    const request = event.request;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request, { cache: "no-store" })
            .then(function(response) {
                const copie = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put("./index.html", copie);
                });
                return response;
            })
            .catch(function() {
                return caches.match("./index.html");
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request, { ignoreSearch: true })
        .then(function(cached) {
            if (cached) return cached;

            return fetch(request)
            .then(function(response) {
                if (response && (response.ok || response.type === "opaque")) {
                    const copie = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(request, copie);
                    });
                }
                return response;
            });
        })
    );
});
