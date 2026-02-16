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
     // 🔥 Activer Direct au démarrage
    activateTab("maintenant");

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
    document.querySelectorAll(".tab-btn").forEach((btn, idx) => {
        btn.addEventListener("click", () => {
            // Déterminer la direction : si l'index cliqué > index actuel, direction = "left"
            const direction = idx > currentTabIndex ? "left" : "right";
            goToTab(idx, direction);
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

    // Animation de sortie pour les chaînes
    logos.classList.add("slide-exit");
    
    // Attendre la fin de l'animation avant de cacher
    setTimeout(() => {
        logos.classList.add("hidden");
        logos.classList.remove("slide-exit");
    }, 350);

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
    
    // Animation d'entrée pour les programmes
    cont.classList.remove("hidden");
    cont.classList.add("slide-enter");
    
    // Nettoyer la classe d'animation après
    setTimeout(() => {
        cont.classList.remove("slide-enter");
    }, 350);
}

function resetJourneeView() {
    document.getElementById("app-title").textContent = "Programme TV";
    const logos = document.getElementById("channel-list");
    const cont = document.getElementById("journee-programmes");
    
    // Animation de sortie pour les programmes
    cont.classList.add("slide-exit");
    
    // Attendre la fin de l'animation avant de cacher
    setTimeout(() => {
        cont.classList.add("hidden");
        cont.classList.remove("slide-exit");
        cont.innerHTML = "";
    }, 350);
    
    // Animation d'entrée pour les chaînes
    logos.classList.remove("hidden");
    logos.classList.add("slide-enter");
    
    // Nettoyer la classe d'animation après
    setTimeout(() => {
        logos.classList.remove("slide-enter");
    }, 350);
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
    const categoriesAllocine = ["Film", "Série", "Téléfilm", "Cinema","Series","Action","Animation","Aventure","Comédie","Drame","Fantastique","Horreur","Policier","Science-Fiction","Thriller"];

    if (categoriesAllocine.includes(prog.category)) {
        document.getElementById("detail-allocine-block").innerHTML =
            `<a href="${allocineSearchUrl(prog.title)}" target="_blank">📝 Infos AlloCiné</a>`;
    }
    else {
        document.getElementById("detail-allocine-block").innerHTML = "";
        }
    

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
    const modal = document.getElementById("detail-modal");
    const content = document.querySelector(".detail-content");
    
    // Ajouter l'animation de sortie vers la droite
    content.style.animation = "slideOutToRight 0.35s ease-in";
    
    // Attendre la fin de l'animation avant de cacher
    setTimeout(() => {
        modal.classList.add("hidden");
        content.style.animation = "slideInFromRight 0.3s ease-out";
        isModalVisible = false;
    }, 350);
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

    // Tracker la direction : diff > 0 = swipe vers la gauche, diff < 0 = swipe vers la droite
    const direction = diff > 0 ? "left" : "right";
    
    if (diff > 0) goToTab(currentTabIndex + 1, direction);
    else goToTab(currentTabIndex - 1, direction);
});

function goToTab(index, direction = "left") {
    if (index < 0 || index >= tabButtons.length) return;

    const currentTab = tabContents[currentTabIndex];
    const nextTab = tabContents[index];

    // Ajouter animation de sortie à l'onglet actuel
    if (direction === "left") {
        currentTab.classList.add("slide-out-left");
    } else {
        currentTab.classList.add("slide-out-right");
    }

    // Ajouter animation d'entrée au nouvel onglet
    nextTab.classList.remove("visible");
    nextTab.classList.add("visible");
    if (direction === "left") {
        nextTab.classList.add("slide-in-right");
    } else {
        nextTab.classList.add("slide-in-left");
    }

    // Attendre la fin des animations
    setTimeout(() => {
        // Mettre à jour les onglets
        tabButtons.forEach(btn => btn.classList.remove("active"));
        tabContents.forEach(sec => {
            sec.classList.remove("visible");
            sec.classList.remove("slide-out-left", "slide-out-right", "slide-in-left", "slide-in-right");
        });

        tabButtons[index].classList.add("active");
        nextTab.classList.add("visible");

        currentTabIndex = index;
    }, 350);
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
        // Animation de sortie vers la droite pour les programmes
        jp.classList.add("slide-exit-right");
        
        // Attendre la fin de l'animation avant de cacher
        setTimeout(() => {
            jp.classList.add("hidden");
            jp.classList.remove("slide-exit-right");
        }, 350);
        
        // Animation d'entrée de la gauche pour les chaînes
        cl.classList.remove("hidden");
        cl.classList.add("slide-enter-left");
        
        // Nettoyer la classe d'animation après
        setTimeout(() => {
            cl.classList.remove("slide-enter-left");
        }, 350);
        
        cl.scrollTop = 0;
    }
});
function allocineSearchUrl(title) {
    const encoded = encodeURIComponent(title);
    return `https://www.allocine.fr/rechercher/?q=${encoded}`;
}
