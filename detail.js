const params = new URLSearchParams(window.location.search);
const ch = params.get("ch");
const startMs = parseInt(params.get("start"), 10);

const XMLTV_URL = "./xmltv_tnt.xml";

(async () => {
    const txt = await (await fetch(XMLTV_URL)).text();
    const xml = new DOMParser().parseFromString(txt, "text/xml");

    let found = null;

    xml.querySelectorAll("programme").forEach(p => {
        if (p.getAttribute("channel") !== ch) return;

        const start = parseDate(p.getAttribute("start"));
        if (start.getTime() !== startMs) return;

        const stop = parseDate(p.getAttribute("stop"));
        found = {
            ch,
            start,
            stop,
            title: p.querySelector("title")?.textContent ?? "",
            desc: p.querySelector("desc")?.textContent ?? "",
            category: p.querySelector("category")?.textContent ?? "",
            icon: p.querySelector("icon")?.getAttribute("src") ?? ""
        };
    });

    display(found);
})();

function parseDate(s) {
    const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
    const hh = s.slice(8, 10), mm = s.slice(10, 12), ss = s.slice(12, 14);
    const tz = s.slice(15, 18) + ":" + s.slice(18);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}${tz}`);
}

function display(p) {
    document.getElementById("detail").innerHTML = `
        <img src="${p.icon}" style="width:100%;max-height:250px;object-fit:cover;">
        <div class="zone-texte">
        <h1>${p.title}</h1>
        <p><strong>${p.category}</strong> – ${duration(p)}</p>
        <p>${p.desc}</p>
        </div>
    `;
}

function duration(p) {
    return Math.round((p.stop - p.start) / 60000) + " min";
}

let touchstartX = 0;
document.addEventListener('touchstart', e => touchstartX = e.changedTouches[0].screenX);
document.addEventListener('touchend', e => {
    // Swipe vers la droite pour retour
    if (e.changedTouches[0].screenX - touchstartX > 100) window.history.back();
});