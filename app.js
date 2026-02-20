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
    history.replaceState({ home: true }, "", "");
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
// GESTION DU BOUTON RETOUR DU SMARTPHONE
// -----------------------------------------
window.addEventListener("popstate", (e) => {

    const state = e.state;

    // Fermer un détail
    if (isModalVisible) {
        closeDetail(false);
        return;
    }

    // Retour vers accueil (logos)
    if (!state || state.home) {
        resetJourneeView();
        return;
    }

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

    // Télécharge le fichier XMLTV puis lit son contenu sous forme de texte
    const txt = await (await fetch(XMLTV_URL)).text();

    // Convertit la chaîne XML en un document DOM exploitable
    const xml = new DOMParser().parseFromString(txt, "text/xml");

    // Structures principales : liste par chaîne + liste générale
    programmes = {};   // programmes["TF1"] = [...]
    allPrograms = [];  // liste de TOUTES les entrées

    // --------------------------------------------------
    // Fonctions utilitaires pour éviter des répétitions
    // --------------------------------------------------

    // getText : renvoie le texte d’un noeud (ou "" si absent)
    const getText = (node, selector) =>
        node.querySelector(selector)?.textContent ?? "";

    // getAttr : renvoie une valeur d'attribut (ex: <icon src="...">)
    const getAttr = (node, selector, attr) =>
        node.querySelector(selector)?.getAttribute(attr) ?? "";

    // getList : renvoie une liste de textes (ex: tous les <actor>)
    const getList = (node, selector) =>
        node
            ? Array.from(node.querySelectorAll(selector)).map(n => n.textContent)
            : [];

    // --------------------------------------------------
    // Extraction de TOUTES les <programme> du XML
    // --------------------------------------------------
    xml.querySelectorAll("programme").forEach(p => {

        // Nom de la chaîne (attribut "channel" dans <programme>)
        const ch = p.getAttribute("channel");

        // Initialise la liste des programmes de la chaîne si besoin
        if (!programmes[ch]) programmes[ch] = [];

        // Récupère le bloc <credits> une seule fois
        const credits = p.querySelector("credits");

        // --------------------------------------------------
        // Création d’un objet standardisé représentant le programme
        // --------------------------------------------------
        const obj = {
            ch,   // nom chaîne

            // Dates début/fin converties en Date JavaScript
            start: parseDate(p.getAttribute("start")),
            stop:  parseDate(p.getAttribute("stop")),

            // Infos simples extraites via utilitaires
            title:      getText(p, "title"),
            subtitle:   getText(p, "sub-title"),
            desc:       getText(p, "desc"),
            category:   getText(p, "category"),
            icon:       getAttr(p, "icon", "src"),
            date:       getText(p, "date"),
            country:    getText(p, "country"),
            episodeNum: getText(p, "episode-num"),
            rating:     getText(p, "rating value"),

            // --------------------------------------------------
            // Extraction des crédits (listes)
            // --------------------------------------------------
            actors:     getList(credits, "actor"),
            directors:  getList(credits, "director"),
            producers:  getList(credits, "producer"),
            editors:    getList(credits, "editor"),
            adapters:   getList(credits, "adapter"),
            composers:  getList(credits, "composer"),
            guests:     getList(credits, "guest"),
        };

        // Ajoute le programme dans la liste de sa chaîne
        programmes[ch].push(obj);

        // Ajoute aussi le programme dans la liste globale
        allPrograms.push(obj);
    });

    // Liste des chaînes utilisées
    channels = Object.keys(programmes);

    // Met à jour les affichages
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
// ==================================================
// CONFIG
// ==================================================

const ANIM_TIME = 350;


// ==================================================
// DOM HELPERS
// ==================================================

function $(id) {
    return document.getElementById(id);
}

function clear(el) {
    el.innerHTML = "";
}


// ==================================================
// ANIMATIONS
// ==================================================

function animateExit(el, callback) {

    el.classList.add("slide-exit");

    setTimeout(() => {

        el.classList.remove("slide-exit");

        if (callback) {
            callback();
        }

    }, ANIM_TIME);
}


function animateEnter(el) {

    el.classList.remove("hidden");
    el.classList.add("slide-enter");

    setTimeout(() => {
        el.classList.remove("slide-enter");
    }, ANIM_TIME);
}


// ==================================================
// CHANNEL LIST
// ==================================================

function renderJourneeChannels() {

    const list  = $("channel-list");
    const title = $("one-channel-title");

    title.classList.add("hidden");
    clear(list);

    channels.forEach(ch => {

        const btn = document.createElement("button");

        btn.addEventListener("click", () => {
            showJourneeChannel(ch);
        });

        const img = document.createElement("img");

        img.className = "logo";
        img.src = `logos/${sanitizeChannelName(ch)}.png`;
        img.alt = ch;
        img.onerror = () => logoFallback(img, ch);

        btn.appendChild(img);
        list.appendChild(btn);
    });
}


// ==================================================
// SINGLE CHANNEL VIEW
// ==================================================

function showJourneeChannel(channel) {
    history.pushState(
        { channel: channel },
        "",
        ""
    );

    const logos = $("channel-list");
    const cont  = $("journee-programmes");
    const title = $("one-channel-title");

    // Sortie logos
    animateExit(logos, () => {
        logos.classList.add("hidden");
    });

    title.textContent = channel;

    renderChannelPrograms(channel, cont);

    animateEnter(cont);
    animateEnter(title);
}


// ==================================================
// RENDER PROGRAMS FOR ONE CHANNEL
// ==================================================

function renderChannelPrograms(channel, cont) {

    const now = new Date();

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const filtered = programmes[channel].filter(p =>
        p.start <= endOfDay && p.stop >= now
    );

    cont.innerHTML = `
        <button class="back-btn" onclick="resetJourneeView()">
            ⬅ Retour
        </button>

        ${filtered.map(renderSimple).join("")}
    `;
}


// ==================================================
// RESET VIEW
// ==================================================

function resetJourneeView() {

    const logos = $("channel-list");
    const cont  = $("journee-programmes");
    const title = $("one-channel-title");

    animateExit(cont, () => {

        cont.classList.add("hidden");
        clear(cont);
    });

    animateExit(title, () => {

        title.classList.add("hidden");
    });

    animateEnter(logos);
}


// ==================================================
// TIME SLOTS (NOW / TONIGHT / LATE)
// ==================================================

function renderSlot(listId, start, end) {

    const list = $(listId);
    clear(list);

    channels.forEach(ch => {

        let prog;

        // NOW
        if (!start && !end) {

            const now = new Date();

            prog = programmes[ch].find(p =>
                p.start <= now && p.stop >= now
            );

        }
        // TONIGHT / LATE
        else {

            prog = bestOverlap(ch, start, end);
        }

        if (prog) {
            list.innerHTML += renderNormal(prog);
        }
    });
}


// ==================================================
// PUBLIC SLOTS
// ==================================================

function renderNow() {
    renderSlot("now-list");
}


function renderTonight() {

    const start = new Date();
    const end   = new Date();

    start.setHours(21, 0, 0);
    end.setHours(22, 30, 0);

    renderSlot("tonight-list", start, end);
}


function renderLate() {

    const start = new Date();
    const end   = new Date();

    start.setHours(22, 30, 0);
    end.setHours(23, 59, 59);

    renderSlot("late-list", start, end);
}


// ==================================================
// OVERLAP
// ==================================================

function bestOverlap(channel, t1, t2) {

    let best = null;
    let max  = 0;

    programmes[channel].forEach(p => {

        const overlap =
            Math.min(p.stop, t2) -
            Math.max(p.start, t1);

        if (overlap > max) {

            max = overlap;
            best = p;
        }
    });

    return best;
}


// ==================================================
// RENDERERS
// ==================================================

function renderSimple(p) {

    const progId =
        `prog-${encode(p.ch)}-${p.start.getTime()}`;

    return `
    <div id="${progId}"
         class="program-simple"
         onclick="goDetail('${encode(p.ch)}','${p.start.getTime()}')">

        <div class="time">
            ${formatTime(p.start)}
        </div>

        <div>

            <div class="title">
                <strong>${p.title}</strong>
            </div>

            <div class="type">
                ${p.category}
            </div>

        </div>

        <img src="${p.icon}">
    </div>`;
}


function renderNormal(p) {

    const start = formatTime(p.start);
    const end   = formatTime(p.stop);

    return `
    <div class="program-normal"
         onclick="goDetail('${encode(p.ch)}','${p.start.getTime()}')">

        <img class="logo"
             src="logos/${sanitizeChannelName(p.ch)}.png"
             alt="${p.ch}"
             onerror="logoFallback(this, '${p.ch}')">

        <div class="info">

            <div class="time">
                ${start} – ${end}
            </div>

            <div class="title">
                <strong>${p.title}</strong>
            </div>

            <div class="type">
                ${p.category} – ${duration(p)}
            </div>

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
    // Ajouter un état dans l'historique pour intercepter le bouton Retour
    history.pushState({ detail: true }, "");

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
    const categoriesAllocine = ["film", "Série", "Cinema", "Serie", "Action", "Animation", "Aventure", "Comédie", "Drame", "Fantastique", "Horreur", "Policier", "fiction", "Thriller"];

    const allocineBlock = document.getElementById("detail-allocine-block");
    
    const categoryNorm = normalize(prog.category);
    
    const match = categoriesAllocine.some(cat =>
        categoryNorm.includes(normalize(cat))
    );
    
    if (match) {
        allocineBlock.style.display = "block"; 
        allocineBlock.innerHTML =
            `<a href="${allocineSearchUrl(prog.title)}" target="_blank">📝 Infos AlloCiné</a>`;
    } else {
        allocineBlock.style.display = "none";
        allocineBlock.innerHTML = "";
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

function closeDetail(doBack = true) {
    const modal = document.getElementById("detail-modal");
    const content = document.querySelector(".detail-content");

    // Animation sortie
    content.style.animation = "slideOutToRight 0.35s ease-in";

    setTimeout(() => {
        modal.classList.add("hidden");
        content.style.animation = "slideInFromRight 0.3s ease-out";

        isModalVisible = false;

        // Si la fermeture vient d'un clic bouton → revenir en arrière dans l’historique
        if (doBack && history.state && history.state.detail) {
            history.back();
        }
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
        const title = document.getElementById("one-channel-title");

        logos.classList.add("hidden");
        programmesDiv.classList.remove("hidden");
        title.classList.remove("hidden");

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
    const title = document.getElementById("one-channel-title");

    if (jp.classList.contains("hidden") || isModalVisible) return;

    const endX = e.changedTouches[0].clientX;
    const diff = endX - psSwipeStartX;

    if (diff > 60 && !disableProgramSimpleSwipe) {
        // Animation de sortie vers la droite pour les programmes
        jp.classList.add("slide-exit-right");
        
        // Attendre la fin de l'animation avant de cacher
        setTimeout(() => {
            jp.classList.add("hidden");
            title.classList.add("hidden");
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


function normalize(str) {
    return str
        .normalize("NFD")                // décompose caractères + accents
        .replace(/[\u0300-\u036f]/g, "") // supprime les accents
        .toLowerCase();                  // met en minuscule
}


