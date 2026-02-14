// detail.js modifié selon ta demande
// ------------------------------------------------------
// Récupération des paramètres
// ------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const ch = decodeURIComponent(params.get("ch"));
const startMs = parseInt(params.get("start"), 10);

let programmes = {};

// ------------------------------------------------------
// Charger XMLTV pour reconstruire l'objet complet programme
// ------------------------------------------------------
fetch("./xmltv_tnt.xml")
    .then(r => r.text())
    .then(txt => {
        const xml = new DOMParser().parseFromString(txt, "text/xml");

        xml.querySelectorAll("programme").forEach(p => {
            const channel = p.getAttribute("channel");
            if (!programmes[channel]) programmes[channel] = [];

            const start = parseDate(p.getAttribute("start"));
            const stop = parseDate(p.getAttribute("stop"));

            const title = p.querySelector("title")?.textContent ?? "";
            const desc = p.querySelector("desc")?.textContent ?? "";
            const category = p.querySelector("category")?.textContent ?? "";
            const icon = p.querySelector("icon")?.getAttribute("src") ?? "";

            // --- Lecture des crédits ---
            const creditsNode = p.querySelector("credits");

            const actors = creditsNode
                ? Array.from(creditsNode.querySelectorAll("actor")).map(a => a.textContent)
                : [];

            const composers = creditsNode
                ? Array.from(creditsNode.querySelectorAll("composer")).map(a => a.textContent)
                : [];

            const guests = creditsNode
                ? Array.from(creditsNode.querySelectorAll("guest")).map(a => a.textContent)
                : [];

            programmes[channel].push({
                ch: channel,
                start,
                stop,
                title,
                desc,
                category,
                icon,
                actors,
                composers,
                guests
            });
        });

        const prog = programmes[ch]?.find(p => p.start.getTime() === startMs);
        if (prog) renderDetail(prog);
    });

// ------------------------------------------------------
// Fonctions utilitaires
// ------------------------------------------------------
function parseDate(s) {
    const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
    const hh = s.slice(8, 10), mm = s.slice(10, 12), ss = s.slice(12, 14);
    const tz = s.slice(15, 18) + ":" + s.slice(18);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}${tz}`);
}

function formatTime(d) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------
// Affichage du détail
// ------------------------------------------------------
function renderDetail(p) {
    document.getElementById("title").textContent = p.title;
    document.getElementById("time").textContent = `${formatTime(p.start)} – ${formatTime(p.stop)}`;
    document.getElementById("category").textContent = p.category;
    document.getElementById("desc").textContent = p.desc;

    if (p.icon) {
        const img = document.getElementById("visuel");
        img.src = p.icon;
        img.classList.remove("hidden");
    }

    renderCredits(p);
}

// ------------------------------------------------------
// Affichage des crédits
// ------------------------------------------------------
function renderCredits(p) {
    const div = document.getElementById("credits-block");
    let html = "";

    if (p.actors?.length) {
        html += `<div class="credit-section"><strong>Acteurs :</strong><br>` +
                `<span class="credit-small">${p.actors.join(", ")}</span></div>`;
    }

    if (p.composers?.length) {
        html += `<div class="credit-section"><strong>Compositeurs :</strong><br>` +
                `<span class="credit-small">${p.composers.join(", ")}</span></div>`;
    }

    if (p.guests?.length) {
        html += `<div class="credit-section"><strong>Invités :</strong><br>` +
                `<span class="credit-small">${p.guests.join(", ")}</span></div>`;
    }

    div.innerHTML = html;
}
// --- Swipe pour revenir en arrière depuis la page détail ---
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;

    const diffX = touchEndX - touchStartX;

    // Swipe vers la droite => retour
    if (diffX > 70) {
        history.back();
    }
});
