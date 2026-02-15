const XMLTV_URL = "./xmltv_tnt.xml";

let programmes = {};
let channels = [];
let allPrograms = [];

// Flag pour bloquer le swipe program-simple juste après retour du détail
let disableProgramSimpleSwipe = false;

// Variables pour le swipe de la modal
let modalSwipeStartX = 0;
let isModalVisible = false;

// Programme actuellement affiché en détail
let currentDetailProgram = null;

// -----------------------------------------
// INIT
// -----------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    initTabs();

    const savedTab = localStorage.getItem("lastActiveTab");
    if (savedTab) {
        activateTab(savedTab);
        localStorage.removeItem("lastActiveTab");
    }

    // ⚠️ Maintenant on restaure l'origine APRES le chargement du XMLTV
    loadXML().then(() => {
        restoreOriginView();
        updateCurrentIndex();   // <-- essentiel !
    });
    
    // Fermer la modal au clic sur le bouton retour
    document.querySelector(".detail-back-btn").addEventListener("click", closeDetail);
    
    // Fermer la modal au clic en dehors du contenu
    document.getElementById("detail-modal").addEventListener("click", e => {
        if (e.target.id === "detail-modal") {
            closeDetail();
        }
    });
});

// -----------------------------------------
// TABS
// -----------------------------------------
function initTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            document.querySelectorAll(".tab-content")
                .forEach(c => c.classList.remove("visible"));

            document.getElementById(btn.dataset.tab).classList.add("visible");

            resetJourneeView();
        });
    });
}

// -----------------------------------------
// LOAD XMLTV
// -----------------------------------------
async function loadXML() {
    const txt = await (await fetch(XMLTV_URL)).text();
    const xml = new DOMParser().parseFromString(txt, "text/xml");

    programmes = {};
    allPrograms = [];

    xml.querySelectorAll("programme").forEach(p => {
        const ch = p.getAttribute("channel");
        if (!programmes[ch]) programmes[ch] = [];

        const start = parseDate(p.getAttribute("start"));
        const stop = parseDate(p.getAttribute("stop"));
        const title = p.querySelector("title")?.textContent ?? "";
        const subtitle = p.querySelector("sub-title")?.textContent ?? "";
        const desc = p.querySelector("desc")?.textContent ?? "";
        const category = p.querySelector("category")?.textContent ?? "";
        const icon = p.querySelector("icon")?.getAttribute("src") ?? "";
        const date = p.querySelector("date")?.textContent ?? "";
        const country = p.querySelector("country")?.textContent ?? "";
        const episodeNum = p.querySelector("episode-num")?.textContent ?? "";
        const rating = p.querySelector("rating value")?.textContent ?? "";

        // Récupération des crédits
        const creditsNode = p.querySelector("credits");

        const actors = creditsNode
            ? Array.from(creditsNode.querySelectorAll("actor")).map(a => a.textContent)
            : [];

        const directors = creditsNode
            ? Array.from(creditsNode.querySelectorAll("director")).map(a => a.textContent)
            : [];

        const producers = creditsNode
            ? Array.from(creditsNode.querySelectorAll("producer")).map(a => a.textContent)
            : [];

        const editors = creditsNode
            ? Array.from(creditsNode.querySelectorAll("editor")).map(a => a.textContent)
            : [];

        const adapters = creditsNode
            ? Array.from(creditsNode.querySelectorAll("adapter")).map(a => a.textContent)
            : [];

        const composers = creditsNode
            ? Array.from(creditsNode.querySelectorAll("composer")).map(a => a.textContent)
            : [];

        const guests = creditsNode
            ? Array.from(creditsNode.querySelectorAll("guest")).map(a => a.textContent)
            : [];

        const obj = {
            ch,
            start,
            stop,
            title,
            subtitle,
            desc,
            category,
            icon,
            date,
            country,
            episodeNum,
            rating,
            actors,
            directors,
            producers,
            editors,
            adapters,
            composers,
            guests
        };


        programmes[ch].push(obj);
        allPrograms.push(obj);
    });

    channels = Object.keys(programmes);

    renderJourneeChannels();
    renderNow();
    renderTonight();
    renderLate();
}

// -----------------------------------------
// DATE PARSER
// -----------------------------------------
function parseDate(s) {
    const y = s.slice(0, 4),
          m = s.slice(4, 6),
          d = s.slice(6, 8);
    const hh = s.slice(8, 10),
          mm = s.slice(10, 12),
          ss = s.slice(12, 14);
    const tz = s.slice(15, 18) + ":" + s.slice(18);

    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}${tz}`);
}

// -----------------------------------------
// JOURNÉE – LOGOS + PROGRAMMES
// -----------------------------------------
function renderJourneeChannels() {
    const list = document.getElementById("channel-list");
    list.innerHTML = "";

    channels.forEach(ch => {
        const btn = document.createElement("button");
        btn.onclick = () => showJourneeChannel(ch);

        const img = document.createElement("img");
        img.className = "logo";
        img.src = `logos/${sanitizeChannelName(ch)}.png`;
        img.alt = ch;
        img.onerror = () => logoFallback(img, ch);

        btn.appendChild(img);
        list.appendChild(btn);
    });
}

function showJourneeChannel(channel) {
    const logos = document.getElementById("channel-list");
    const cont = document.getElementById("journee-programmes");

    logos.classList.add("hidden");
    cont.classList.remove("hidden");

    document.getElementById("app-title").textContent = channel;

    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const filtered = programmes[channel].filter(p =>
        p.start <= endOfDay && p.stop >= now
    );

    cont.innerHTML =
        `<button class="back-btn" onclick="resetJourneeView()">⬅ Retour</button>` +
        filtered.map(p => renderSimple(p)).join("");



    }

function resetJourneeView() {
    document.getElementById("app-title").textContent = "Programme TV";
    document.getElementById("channel-list").classList.remove("hidden");

    const cont = document.getElementById("journee-programmes");
    cont.classList.add("hidden");
    cont.innerHTML = "";
}

// -----------------------------------------
// DIRECT / TONIGHT / LATE
// -----------------------------------------
function renderNow() {
    const now = new Date();
    const list = document.getElementById("now-list");
    list.innerHTML = "";

    channels.forEach(ch => {
        const p = programmes[ch].find(p => p.start <= now && p.stop >= now);
        if (p) list.innerHTML += renderNormal(p);
    });
}

function renderTonight() {
    const start = new Date();
    const end = new Date();
    start.setHours(21, 0, 0);
    end.setHours(22, 30, 0);

    const list = document.getElementById("tonight-list");
    list.innerHTML = "";

    channels.forEach(ch => {
        const p = bestOverlap(ch, start, end);
        if (p) list.innerHTML += renderNormal(p);
    });
}

function renderLate() {
    const start = new Date();
    const end = new Date();
    start.setHours(22, 30, 0);
    end.setHours(23, 59, 59);

    const list = document.getElementById("late-list");
    list.innerHTML = "";

    channels.forEach(ch => {
        const p = bestOverlap(ch, start, end);
        if (p) list.innerHTML += renderNormal(p);
    });
}

function bestOverlap(channel, t1, t2) {
    let best = null, max = 0;

    programmes[channel].forEach(p => {
        const overlap = Math.min(p.stop, t2) - Math.max(p.start, t1);
        if (overlap > max) {
            max = overlap;
            best = p;
        }
    });

    return best;
}

// -----------------------------------------
// RENDERERS
// -----------------------------------------
function renderSimple(p) {
    const progId = `prog-${encode(p.ch)}-${p.start.getTime()}`;
    return `
    <div id="${progId}" class="program-simple" onclick="goDetail('${encode(p.ch)}','${p.start.getTime()}')">
        <div class="time">${formatTime(p.start)}</div>
        <div>
            <div class="title"><strong>${p.title}</strong></div>
            <div class="type">${p.category}</div>
        </div>
        <img src="${p.icon}">
    </div>`;
}

function renderNormal(p) {
    const start = formatTime(p.start);
    const end = formatTime(p.stop);

    return `
    <div class="program-normal" onclick="goDetail('${encode(p.ch)}','${p.start.getTime()}')">
        <img class="logo"
             src="logos/${sanitizeChannelName(p.ch)}.png"
             alt="${p.ch}"
             onerror="logoFallback(this, '${p.ch}')">
        <div class="info">
            <div class="time">${start} – ${end}</div>
            <div class="title"><strong>${p.title}</strong></div>
            <div class="type">${p.category} – ${duration(p)}</div>
        </div>
        <img class="visuel" src="${p.icon}">
    </div>`;
}

function logoFallback(img, channelName) {
    const span = document.createElement("span");
    span.className = "logo-fallback";
    span.textContent = channelName;
    img.replaceWith(span);
}

// -----------------------------------------
// HELPERS
// -----------------------------------------
function sanitizeChannelName(name) {
    return name
        .replace(".fr", "")
        .replace(/\s+/g, "")
        .replace("+", "Plus")
        .replace(/[éèê]/g, "e")
        .replace(/[àâ]/g, "a")
        .replace(/[ùû]/g, "u");
}

function goDetail(channel, startMs) {
    const decodedChannel = decodeURIComponent(channel);
    const prog = allPrograms.find(p => p.ch === decodedChannel && p.start.getTime() === parseInt(startMs));
    
    if (prog) {
        showDetail(prog);
    }
}

function showDetail(prog) {
    // Sauvegarder le programme courant pour la navigation
    currentDetailProgram = prog;
    
    document.getElementById("detail-title").textContent = prog.title;
    
    // Afficher le sous-titre s'il existe
    const subtitleElem = document.getElementById("detail-subtitle");
    if (prog.subtitle) {
        subtitleElem.textContent = prog.subtitle;
        subtitleElem.classList.remove("hidden");
    } else {
        subtitleElem.classList.add("hidden");
    }
    
    document.getElementById("detail-time").textContent = `${formatTime(prog.start)} – ${formatTime(prog.stop)}`;
    document.getElementById("detail-category").textContent = prog.category;
    document.getElementById("detail-desc").textContent = prog.desc;

    // Afficher les infos supplémentaires (année, pays, épisode, classification)
    renderDetailInfo(prog);

    // Afficher le logo de la chaîne
    const channelLogo = document.getElementById("detail-channel-logo");
    channelLogo.src = `logos/${sanitizeChannelName(prog.ch)}.png`;
    channelLogo.alt = prog.ch;
    channelLogo.classList.remove("hidden");
    channelLogo.onerror = () => logoFallback(channelLogo, prog.ch);

    if (prog.icon) {
        const img = document.getElementById("detail-visuel");
        img.src = prog.icon;
        img.classList.remove("hidden");
    } else {
        document.getElementById("detail-visuel").classList.add("hidden");
    }

    renderDetailCredits(prog);
    
    const modal = document.getElementById("detail-modal");
    modal.classList.remove("hidden");
    isModalVisible = true;
}

function renderDetailInfo(p) {
    const div = document.getElementById("detail-info-block");
    let html = "";

    const infoParts = [];
    
    if (p.date) infoParts.push(p.date);
    if (p.country) infoParts.push(p.country);
    if (p.episodeNum) infoParts.push(`Épisode: ${p.episodeNum}`);
    if (p.rating) infoParts.push(`${p.rating}`);
    
    if (infoParts.length > 0) {
        html = `<div class="detail-info-items">${infoParts.join(" • ")}</div>`;
    }
    
    div.innerHTML = html;
}

function renderDetailCredits(p) {
    const div = document.getElementById("detail-credits-block");
    let html = "";

    if (p.directors?.length) {
        html += `<div class="credit-section"><strong>Réalisateur(s) :</strong><br>` +
                `<span class="credit-small">${p.directors.join(", ")}</span></div>`;
    }

    if (p.actors?.length) {
        html += `<div class="credit-section"><strong>Acteurs :</strong><br>` +
                `<span class="credit-small">${p.actors.join(", ")}</span></div>`;
    }

    if (p.producers?.length) {
        html += `<div class="credit-section"><strong>Producteur(s) :</strong><br>` +
                `<span class="credit-small">${p.producers.join(", ")}</span></div>`;
    }

    if (p.adapters?.length) {
        html += `<div class="credit-section"><strong>Adaptateur(s) :</strong><br>` +
                `<span class="credit-small">${p.adapters.join(", ")}</span></div>`;
    }

    if (p.composers?.length) {
        html += `<div class="credit-section"><strong>Compositeur(s) :</strong><br>` +
                `<span class="credit-small">${p.composers.join(", ")}</span></div>`;
    }

    if (p.editors?.length) {
        html += `<div class="credit-section"><strong>Éditeur(s) :</strong><br>` +
                `<span class="credit-small">${p.editors.join(", ")}</span></div>`;
    }

    if (p.guests?.length) {
        html += `<div class="credit-section"><strong>Production :</strong><br>` +
                `<span class="credit-small">${p.guests.join(", ")}</span></div>`;
    }

    div.innerHTML = html;
}


function goToChannelProgram() {
    if (!currentDetailProgram) return;
    
    const prog = currentDetailProgram;
    const progId = `prog-${encode(prog.ch)}-${prog.start.getTime()}`;
    
    // Fermer la modal
    closeDetail();
    
    // Attendre un peu que la modal se ferme
    setTimeout(() => {
        // Aller à l'onglet "Journée"
        activateTab("journee");
        
        // Trouver et cliquer sur le bouton de la chaîne
        const channelButtons = document.querySelectorAll("#channel-list button");
        let channelBtn = null;
        
        channelButtons.forEach(btn => {
            const img = btn.querySelector("img");
            if (img && img.alt === prog.ch) {
                channelBtn = btn;
            }
        });
        
        if (channelBtn) {
            channelBtn.click();
            
            // Une fois les programmes affichés, scroller jusqu'au programme
            setTimeout(() => {
                const progElement = document.getElementById(progId);
                if (progElement) {
                    progElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, 300);
}

function closeDetail() {
    document.getElementById("detail-modal").classList.add("hidden");
    isModalVisible = false;
}

function encode(s) { return encodeURIComponent(s); }

function formatTime(d) {
    return d.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function duration(p) {
    return Math.round((p.stop - p.start) / 60000) + " min";
}

function activateTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-content").forEach(cont => {
        cont.classList.toggle("visible", cont.id === tabName);
    });
}

// -----------------------------------------
// SWIPE ENTRE TABS
// -----------------------------------------
let startX = 0;
let currentTabIndex = 0;

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabContents = Array.from(document.querySelectorAll(".tab-content"));

function updateCurrentIndex() {
    currentTabIndex = tabButtons.findIndex(btn => btn.classList.contains("active"));
}
updateCurrentIndex();

document.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
    
    // Aussi capturer pour le swipe de la modal
    if (isModalVisible) {
        modalSwipeStartX = e.touches[0].clientX;
    }
});

document.addEventListener("touchend", e => {
    // Gérer le swipe de la modal (gauche vers droite = fermeture)
    if (isModalVisible) {
        const endX = e.changedTouches[0].clientX;
        const diff = endX - modalSwipeStartX;
        
        // Swipe de gauche vers droite (diff positif > 80px)
        if (diff > 80) {
            closeDetail();
            return;
        }
    }
    
    // Gérer le swipe des onglets (seulement si la modal n'est pas visible)
    if (isModalVisible) return;
    
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    if (Math.abs(diff) < 50) return;

    if (diff > 0) goToTab(currentTabIndex + 1);
    else goToTab(currentTabIndex - 1);
});

function goToTab(index) {
    if (index < 0 || index >= tabButtons.length) return;

    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabContents.forEach(sec => sec.classList.remove("visible"));

    tabButtons[index].classList.add("active");
    tabContents[index].classList.add("visible");

    currentTabIndex = index;
}

// -----------------------------------------
// RESTAURER ORIGINE (APRES loadXML)
// -----------------------------------------
function restoreOriginView() {
    const origin = sessionStorage.getItem("origin");

    if (origin === "program-simple") {
        const logos = document.getElementById("channel-list");
        const programmesDiv = document.getElementById("journee-programmes");

        logos.classList.add("hidden");
        programmesDiv.classList.remove("hidden");

        const ch = sessionStorage.getItem("currentChannel");
        if (ch && programmes[ch]) {
            document.getElementById("app-title").textContent = ch;

            const now = new Date();
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const filtered = programmes[ch].filter(p =>
                p.start <= endOfDay && p.stop >= now
            );

            programmesDiv.innerHTML =
                `<button class="back-btn" onclick="resetJourneeView()">⬅ Retour</button>` +
                filtered.map(p => renderSimple(p)).join("");
        }

        disableProgramSimpleSwipe = true;
        setTimeout(() => {
            disableProgramSimpleSwipe = false;
            sessionStorage.removeItem("origin");
        }, 300);
    }

    if (origin === "program-normal") {
        sessionStorage.removeItem("origin");
    }
}

// -----------------------------------------
// SWIPE PROGRAM-SIMPLE → LISTE DES CHAÎNES
// -----------------------------------------
let psSwipeStartX = 0;

document.addEventListener("touchstart", e => {
    const jp = document.getElementById("journee-programmes");
    if (!jp.classList.contains("hidden") && !isModalVisible) {
        psSwipeStartX = e.touches[0].clientX;
    }
});

document.addEventListener("touchend", e => {
    const jp = document.getElementById("journee-programmes");
    const cl = document.getElementById("channel-list");

    if (jp.classList.contains("hidden") || isModalVisible) return;

    const endX = e.changedTouches[0].clientX;
    const diff = endX - psSwipeStartX;

    if (diff > 60 && !disableProgramSimpleSwipe) {
        jp.classList.add("hidden");
        cl.classList.remove("hidden");
        cl.scrollTop = 0;
    }
});
