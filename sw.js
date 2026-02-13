// -------------------------
// VERSION DU SERVICE WORKER
// -------------------------
const VERSION = "2.7";

// Install : nouvelle version détectée
self.addEventListener("install", (event) => {
  console.log("Service Worker installé - version", VERSION);
  self.skipWaiting();
});

// Activate : prise de contrôle immédiate
self.addEventListener("activate", (event) => {
  console.log("Service Worker activé - version", VERSION);
  clients.claim();

  // Notifie les pages que la version a changé
  clients.matchAll().then(clientsList => {
    clientsList.forEach(client => {
      client.postMessage({
        type: "NEW_VERSION",
        version: VERSION
      });
    });
  });
});

// Obligatoire pour valider la PWA (Chrome)
self.addEventListener("fetch", (event) => {
  // Pas de cache ici (minimal)
});
