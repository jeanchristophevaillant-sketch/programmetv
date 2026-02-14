const XMLTV_URL = "./xmltv_tnt.xml";

let programmes = {};
let channels = [];
let allPrograms = [];

// Flag pour bloquer le swipe program-simple juste après retour du détail
let disableProgramSimpleSwipe = false;

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

function showJourneeChannel(channel) {
    const logos = document.getElementById("channel-list");
    const cont = document.getElementById("journee-programmes");

    logos.classList.add("hidden");
    cont.classList.remove("hidden");

    document.getElementById("app-title").textContent = channel;

    const now = new Date();
    const filtered = programmes[channel].filter(p => p.stop >= now);

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
    const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab;
    localStorage.setItem("lastActiveTab", activeTab);

    const inSimple = !document.getElementById("journee-programmes").classList.contains("hidden");
    const inNormal = activeTab !== "journee";

    if (inSimple) sessionStorage.setItem("origin", "program-simple");
    else if (inNormal) sessionStorage.setItem("origin", "program-normal");
    else sessionStorage.removeItem("origin");

    const cont = document.getElementById("view-container");
    cont.classList.remove("push-reset");
    cont.classList.add("push-left");

    setTimeout(() => {
        window.location.href = `detail.html?ch=${channel}&start=${startMs}`;
    }, 300);
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
});

document.addEventListener("touchend", e => {
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
            const filtered = programmes[ch].filter(p => p.stop >= now);

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
    if (!jp.classList.contains("hidden")) {
        psSwipeStartX = e.touches[0].clientX;
    }
});

document.addEventListener("touchend", e => {
    const jp = document.getElementById("journee-programmes");
    const cl = document.getElementById("channel-list");

    if (jp.classList.contains("hidden")) return;

    const endX = e.changedTouches[0].clientX;
    const diff = endX - psSwipeStartX;

    if (diff > 60 && !disableProgramSimpleSwipe) {
        jp.classList.add("hidden");
        cl.classList.remove("hidden");
        cl.scrollTop = 0;
    }
});
