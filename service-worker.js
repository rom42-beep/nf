const CACHE_NAME = "notes-de-frais-v14-ticket-sync";

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
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js",
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js",
    "https://tessdata.projectnaptha.com/4.0.0_fast/fra.traineddata.gz"
];

async function mettreEnCacheSansBloquer(cache, url) {
    try {
        const reponse = await fetch(
            new Request(url, { cache: "reload", mode: "cors" })
        );

        if (reponse && (reponse.ok || reponse.type === "opaque")) {
            await cache.put(url, reponse.clone());
        }
    } catch (erreur) {
        console.warn("Ressource non précachée :", url, erreur);
    }
}

self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(function(cache) {
            return Promise.allSettled(
                ASSETS.map(function(url) {
                    return mettreEnCacheSansBloquer(cache, url);
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
        .then(function(noms) {
            return Promise.all(
                noms
                .filter(function(nom) {
                    return nom !== CACHE_NAME;
                })
                .map(function(nom) {
                    return caches.delete(nom);
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

    const requete = event.request;
    const url = new URL(requete.url);

    /*
     * Point essentiel de la version stable : les appels Supabase ne doivent
     * jamais passer par le cache du service worker. Cela concerne les tables,
     * l’authentification et le stockage des justificatifs.
     */
    if (
        url.hostname.endsWith(".supabase.co")
        || url.hostname.endsWith(".supabase.in")
    ) {
        event.respondWith(fetch(requete, { cache: "no-store" }));
        return;
    }

    /* Document principal : réseau d’abord, cache uniquement hors ligne. */
    if (requete.mode === "navigate") {
        event.respondWith(
            fetch(requete, { cache: "no-store" })
            .then(function(reponse) {
                if (reponse && reponse.ok) {
                    const copie = reponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put("./index.html", copie);
                    });
                }
                return reponse;
            })
            .catch(async function() {
                return (
                    await caches.match("./index.html")
                    || await caches.match("./")
                    || Response.error()
                );
            })
        );
        return;
    }

    /* Fichiers du site : réseau d’abord afin de recevoir les mises à jour. */
    const memeOrigine = url.origin === self.location.origin;

    if (memeOrigine) {
        event.respondWith(
            fetch(requete, { cache: "no-store" })
            .then(function(reponse) {
                if (reponse && reponse.ok) {
                    const copie = reponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(requete, copie);
                    });
                }
                return reponse;
            })
            .catch(function() {
                return caches.match(requete);
            })
        );
        return;
    }

    /* Bibliothèques externes : cache d’abord pour le fonctionnement hors ligne. */
    event.respondWith(
        caches.match(requete)
        .then(function(copieCache) {
            if (copieCache) return copieCache;

            return fetch(requete)
            .then(function(reponse) {
                if (reponse && (reponse.ok || reponse.type === "opaque")) {
                    const copie = reponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(requete, copie);
                    });
                }
                return reponse;
            });
        })
    );
});
