const XMLTV_URL = "./xmltv_tnt.xml";

let programmes = {};
let channels = [];
let allPrograms = [];

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
    loadXML();
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

    xml.querySelectorAll("programme").forEach(p => {
        const ch = p.getAttribute("channel");

        if (!programmes[ch]) programmes[ch] = [];

        const start = parseDate(p.getAttribute("start"));
        const stop = parseDate(p.getAttribute("stop"));
        const title = p.querySelector("title")?.textContent ?? "";
        const desc = p.querySelector("desc")?.textContent ?? "";
        const category = p.querySelector("category")?.textContent ?? "";
        const icon = p.querySelector("icon")?.getAttribute("src") ?? "";

        const obj = { ch, start, stop, title, desc, category, icon };

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

// BASCULE VERS AFFICHAGE PROGRAMMES
function showJourneeChannel(channel) {
    const container = document.getElementById("journee-container");
    const logos = document.getElementById("channel-list");
    const cont = document.getElementById("journee-programmes");

    logos.classList.add("hidden");
    cont.classList.remove("hidden");

    document.getElementById("app-title").textContent = channel;

    let back = `<button class="back-btn" onclick="resetJourneeView()">⬅ Retour</button>`;

    cont.innerHTML = back + programmes[channel].map(p => renderSimple(p)).join("");
}

// REVENIR À LA LISTE DES LOGOS
function resetJourneeView() {
    document.getElementById("app-title").textContent = "Programme TV";

    document.getElementById("channel-list").classList.remove("hidden");

    const cont = document.getElementById("journee-programmes");
    cont.classList.add("hidden");
    cont.innerHTML = "";
}


// -----------------------------------------
// DIRECT – CE SOIR – 2ÈME PARTIE
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

// -----------------------------------------
// OVERLAP
// -----------------------------------------
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
    return `
    <div class="program-simple" onclick="goDetail('${encode(p.ch)}','${p.start.getTime()}')">
        <div class="time">${formatTime(p.start)}</div>

        <div>
            <div class="title"><strong>${p.title}</strong></div>
            <div class="type">${p.category}</div>
        </div>

        <img src="${p.icon}">
    </div>`;
}

function logoFallback(img, channelName) {
    const span = document.createElement("span");
    span.className = "logo-fallback";
    span.textContent = channelName;
    img.replaceWith(span);
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
    // Sauvegarde l’onglet actif
    const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab;
    localStorage.setItem("lastActiveTab", activeTab);

    window.location.href = `detail.html?ch=${channel}&start=${startMs}`;
}


function encode(s) {
    return encodeURIComponent(s);
}

function formatTime(d) {
    return d.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function duration(p) {
    const min = Math.round((p.stop - p.start) / 60000);
    return min + " min";
}
function activateTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    document.querySelectorAll(".tab-content").forEach(cont => {
        cont.classList.toggle("visible", cont.id === tabName);
    });
}
