// SL-kollen – bussar och båtar. Vilket läge styrs av laddaren (SL_LINJE): buss eller bat.
// Visar de närmaste avgångarna från närmaste hållplats/brygga, alla linjer och håll blandade i tidsordning.
const CONFIGS = {
  buss: {
    key: "buss", label: "bussarna", transports: ["BUS"], color: "#1E5AA8", letter: "B",
    FORCE: "årstaberg", // TILLFÄLLIGT TEST: tvingar hållplatser vars namn börjar så. Ta bort raden när testet är klart.
    stick: 0.15, // km: behåll senaste hållplats om du är närmare än så
    empty: "Inga bussavgångar hittades nära dig",
  },
  bat: {
    key: "bat", label: "båtarna", transports: ["SHIP", "FERRY"], color: "#0E8A9B", letter: "Bt",
    stick: 0.4,
    empty: "Ingen brygga med avgångar hittades nära dig",
  },
};
const CFG = CONFIGS[typeof SL_LINJE !== "undefined" ? SL_LINJE : "buss"] || CONFIGS.buss;
const LITE = 3;
const MYCKET = 6;
const FAMILY = config.widgetFamily || "medium";
const SMALL = FAMILY === "small";
const ROWS = SMALL ? 2 : FAMILY === "large" ? 8 : 3;
const CANDIDATES = 15;
const LINE_MAX = 50;
const BASE = "https://transport.integration.sl.se/v1";
const PAL = {
  g: { bg: "#30D158", fg: "#05310F" },
  y: { bg: "#FFD60A", fg: "#3A2F00" },
  r: { bg: "#FF453A", fg: "#3B0A07" },
};

const fm = FileManager.local();
const dir = fm.documentsDirectory();
const sitesPath = fm.joinPath(dir, "sl_sites.json");
const lastPath = fm.joinPath(dir, `sl_last_${CFG.key}.json`);
const min = (a, b) => Math.round((a - b) / 60000);
const shortName = n => String(n)
  .replace(/^Upplands Väsby$/i, "Upl. Väsby")
  .replace(/\s+centrum$/i, " C");

function readJSON(p) {
  try { return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; }
  catch (e) { return null; }
}

function km(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

async function loadSites() {
  let s = readJSON(sitesPath);
  if (s) return s;
  if (config.runsInWidget) return null;
  const req = new Request(`${BASE}/sites?expand=true`);
  req.timeoutInterval = 40;
  const raw = await req.loadJSON();
  const arr = Array.isArray(raw) ? raw : (raw.sites || []);
  s = arr
    .filter(x => x.lat !== undefined && x.lon !== undefined)
    .map(x => [x.id, x.name, x.lat, x.lon]);
  fm.writeString(sitesPath, JSON.stringify(s));
  return s;
}

// Hämtar avgångar för alla lägen i CFG. null = kunde inte hämta något.
async function fetchDeps(id) {
  const results = await Promise.all(CFG.transports.map(async tr => {
    const req = new Request(`${BASE}/sites/${id}/departures?transport=${tr}`);
    req.timeoutInterval = 10;
    try {
      const data = await req.loadJSON();
      const code = req.response ? req.response.statusCode : 0;
      return code === 200 && Array.isArray(data.departures) ? data.departures : null;
    } catch (e) { return null; }
  }));
  const ok = results.filter(r => r);
  return ok.length ? [].concat(...ok) : null;
}

// Störningar som uttryckligen gäller någon av linjerna som visas.
async function loadStatus(lines) {
  const fail = { text: "Trafikläget kunde inte hämtas", kind: "fail" };
  const ACCESS = /entré|entre|ingång|uppgång|hiss|rulltrappa|trappa|biljettspärr|spärr/i;
  try {
    const all = [];
    for (const tr of CFG.transports) {
      const req = new Request(`https://deviations.integration.sl.se/v1/messages?transport_mode=${tr}&future=false`);
      req.timeoutInterval = 10;
      const data = await req.loadJSON();
      const code = req.response ? req.response.statusCode : 0;
      if (code === 200 && Array.isArray(data)) all.push(...data);
      else if (tr === CFG.transports[0]) return fail;
    }
    const mine = all.filter(m => {
      const txt = (m.message_variants || []).map(x => `${x.header || ""} ${x.details || ""}`).join(" ");
      if (ACCESS.test(txt)) return false;
      const sc = (m.scope && m.scope.lines) || [];
      return sc.some(l => lines.includes(String(l.designation)));
    });
    if (mine.length === 0) return { text: `Inga störningar noterade för ${CFG.label} här`, kind: "ok" };
    const v = mine[0].message_variants || [];
    const sv = v.find(x => x.language === "sv") || v[0] || {};
    let t = String(sv.header || sv.details || "Störning").replace(/\s+/g, " ").trim();
    if (mine.length > 1) t += `\u00A0(+${mine.length - 1}\u00A0till)`;
    return { text: t, kind: "bad" };
  } catch (e) { return fail; }
}

const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const FDBG = [];
async function resolve() {
  let loc = null;
  try { Location.setAccuracyToHundredMeters(); loc = await Location.current(); } catch (e) {}
  const last = readJSON(lastPath);
  if (!loc) {
    if (last) return { st: last, note: "senaste plats" };
    return { error: "Plats saknas. Kör skriptet i appen." };
  }
  if (!CFG.FORCE && last && last.lat !== undefined &&
      km(loc.latitude, loc.longitude, last.lat, last.lon) < CFG.stick) {
    return { st: last, note: "" };
  }
  const sites = await loadSites();
  if (!sites) {
    if (last) return { st: last, note: "senaste plats" };
    return { error: "Kör skriptet i appen en gång" };
  }
  if (CFG.FORCE) {
    const forced = sites.filter(s => norm(s[1]).startsWith(CFG.FORCE))
      .sort((a, b) => (/station/.test(norm(a[1])) ? 0 : 1) - (/station/.test(norm(b[1])) ? 0 : 1))
      .slice(0, 8);
    const fr = await Promise.all(forced.map(s => fetchDeps(s[0])));
    forced.forEach((s, i) => FDBG.push(`${s[1]}:${fr[i] ? fr[i].length : "x"}`));
    if (!forced.length) FDBG.push("inga platser börjar på " + CFG.FORCE);
    for (let i = 0; i < forced.length; i++) {
      if (fr[i] && fr[i].length) {
        const s = forced[i];
        return { st: { id: s[0], name: s[1], lat: s[2], lon: s[3] }, deps: fr[i], note: "testläge" };
      }
    }
  }
  const near = sites
    .map(s => ({ s, d: km(loc.latitude, loc.longitude, s[2], s[3]) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, CANDIDATES);
  const results = await Promise.all(near.map(x => fetchDeps(x.s[0])));
  for (let i = 0; i < near.length; i++) {
    const r = results[i];
    if (r && r.some(d => min(new Date(d.expected || d.scheduled), new Date()) >= -1)) {
      const s = near[i].s;
      const st = { id: s[0], name: s[1], lat: s[2], lon: s[3] };
      fm.writeString(lastPath, JSON.stringify(st));
      return { st, deps: r, note: "" };
    }
  }
  if (last) return { st: last, note: "senaste plats" };
  return { error: CFG.empty };
}

function info(d, now) {
  const exp = new Date(d.expected || d.scheduled);
  const delay = min(exp, new Date(d.scheduled));
  const left = min(exp, now);
  const cancelled = /CANCEL/i.test(`${d.state} ${(d.journey && d.journey.state) || ""}`);
  let level = "g";
  if (cancelled || delay >= MYCKET) level = "r";
  else if (delay >= LITE) level = "y";
  return { exp, delay, left, cancelled, level };
}

// Översta pillen (big): innehållet centrerat. Övriga: innehållet högerjusterat.
function pill(parent, i, big) {
  const W = big ? 56 : 50;
  const numSize = big ? 23 : 17;
  const unitSize = big ? 10 : 9;
  const RIGHT_INSET = 6;
  let label, unit = null;
  if (i.cancelled) label = "Inst.";
  else if (i.left <= 0) label = "Nu";
  else { label = String(i.left); unit = "min"; }
  const labSize = i.cancelled ? Math.round(numSize * 0.6) : numSize;
  let cw = label.length * labSize * 0.62;
  if (unit) cw += 1 + unit.length * unitSize * 0.6;
  const lp = big ? 0 : Math.max(2, Math.round(W - 2 * RIGHT_INSET - cw));

  const p = parent.addStack();
  p.backgroundColor = new Color(PAL[i.level].bg);
  p.cornerRadius = big ? 11 : 9;
  p.size = new Size(W, 0);
  p.setPadding(1, lp, 1, 0);
  p.centerAlignContent();
  const fg = new Color(PAL[i.level].fg);
  const t = p.addText(label);
  t.font = Font.boldSystemFont(labSize);
  t.textColor = fg;
  t.lineLimit = 1;
  if (unit) {
    p.addSpacer(1);
    const u = p.addText(unit);
    u.font = Font.boldSystemFont(unitSize);
    u.textColor = fg;
    u.lineLimit = 1;
  }
}

function splitTwo(text, max) {
  const words = text.split(" ");
  let l1 = "";
  while (words.length && (l1 + " " + words[0]).trim().length <= max) {
    l1 = (l1 + " " + words.shift()).trim();
  }
  if (!l1 && words.length) l1 = words.shift();
  const l2 = words.join(" ");
  return l2 ? [l1, l2] : [l1];
}

// Bussar: blåbussar (stomlinjer) blå, övriga röda. SL skickar ingen linjegrupp för bussar,
// så blåbussarna listas här efter linjenummer (kontrollera listan om SL ändrar stomnätet).
const BLUE_BUSES = ["1", "2", "3", "4", "5", "6", "172", "173", "175", "176", "177", "178", "179",
  "471", "474", "670", "676", "677"];
function badgeColor(d) {
  if (CFG.key !== "buss") return CFG.color;
  const l = d.line || {};
  const blue = /blå/i.test(String(l.group_of_lines || "")) || BLUE_BUSES.includes(String(l.designation));
  return blue ? "#1E5AA8" : "#D32F2F";
}

const res = await resolve();
let deps = res.deps;
let error = res.error;
if (!error && !deps) {
  deps = await fetchDeps(res.st.id);
  if (!deps) error = "Ingen kontakt";
}
const now = new Date();
const stName = res.st ? res.st.name : "";
const all = error ? [] : deps
  .map(d => ({ d, i: info(d, now) }))
  .filter(x => x.i.left >= -1)
  .sort((a, b) => a.i.exp - b.i.exp);
const shown = all.slice(0, ROWS);
const status = error ? null : await loadStatus([...new Set(shown.map(x => String(x.d.line && x.d.line.designation)))]);

const w = new ListWidget();
w.backgroundColor = Color.black();
w.setPadding(0, 0, 0, 0);
const bar = w.addStack();
bar.size = new Size(0, 5);
bar.backgroundColor = new Color(CFG.color);
bar.addSpacer();

const content = w.addStack();
content.layoutVertically();
content.setPadding(6, SMALL ? 10 : 12, 4, SMALL ? 10 : 12);

const top = content.addStack();
top.centerAlignContent();
// Märket ritas som en bild så att bokstaven hamnar exakt i mitten
function lineBadge(letter, color) {
  const N = 96;
  const dc = new DrawContext();
  dc.size = new Size(N, N);
  dc.opaque = false;
  dc.respectScreenScale = false;
  dc.setFillColor(new Color(color));
  dc.fillEllipse(new Rect(0, 0, N, N));
  dc.setTextColor(CFG.letterColor ? new Color(CFG.letterColor) : Color.white());
  dc.setFont(Font.boldSystemFont(letter.length > 1 ? 40 : 54));
  dc.setTextAlignedCenter();
  dc.drawTextInRect(letter, new Rect(0, letter.length > 1 ? 24 : 15, N, N - 15));
  return dc.getImage();
}
const badge = top.addImage(lineBadge(CFG.letter, CFG.color));
badge.imageSize = new Size(24, 24);
top.addSpacer(6);
const t1 = top.addText(stName);
t1.font = Font.boldSystemFont(SMALL ? 15 : 16);
t1.textColor = Color.white();
t1.lineLimit = 1;
t1.minimumScaleFactor = 0.7;
const stamp = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
if (!SMALL) {
  top.addSpacer();
  const right = top.addStack();
  right.layoutVertically();
  const t2 = right.addText(`Uppdaterat ${stamp}`);
  t2.font = Font.systemFont(10);
  t2.textColor = Color.gray();
  t2.rightAlignText();
  if (res.note) {
    const n = right.addText(res.note);
    n.font = Font.systemFont(9);
    n.textColor = Color.gray();
    n.rightAlignText();
  }
}
content.addSpacer(3);

if (error) {
  const e = content.addText(error);
  e.font = Font.systemFont(13);
  e.textColor = Color.orange();
} else {
  // Stor widget: två kolumner av rader skulle bli trångt, så en lista över hela bredden.
  shown.forEach((item, idx) => {
    const { d, i } = item;
    const big = idx === 0;
    const row = content.addStack();
    row.centerAlignContent();
    pill(row, i, big);
    row.addSpacer(big ? 5 : 11); // översta pillen är bredare; lika startpunkt för linjenumren
    // linjenummer i en liten färgad ruta (fast bredd, siffrorna centrerade)
    const num = String((d.line && d.line.designation) || "");
    const NW = num.length > 3 ? 52 : 44;
    const lb = row.addStack();
    lb.backgroundColor = new Color(badgeColor(d));
    lb.cornerRadius = 6;
    lb.size = new Size(NW, SMALL ? 20 : 24);
    lb.centerAlignContent();
    lb.addSpacer();
    const nt = lb.addText(num);
    nt.font = Font.boldSystemFont(SMALL ? 12 : 14);
    nt.textColor = Color.white();
    nt.lineLimit = 1;
    nt.minimumScaleFactor = 0.7;
    lb.addSpacer();
    row.addSpacer(5);
    const dest = row.addText(shortName(d.destination));
    dest.font = big ? Font.boldSystemFont(SMALL ? 13 : 16) : Font.mediumSystemFont(SMALL ? 12 : 15);
    dest.textColor = Color.white();
    dest.lineLimit = 1;
    dest.minimumScaleFactor = 0.6;
    // hållplatsläge (stolpen/"busskuren"), t.ex. A, B, C
    const sp = d.stop_point || {};
    const lage = String(sp.designation || (d.stop && d.stop.designation) || d.stop_point_designation || "").trim();
    if (lage) {
      row.addSpacer();
      const lg = row.addStack();
      lg.backgroundColor = new Color("#2c2c2e");
      lg.cornerRadius = 6;
      lg.setPadding(2, 6, 2, 6);
      const lt = lg.addText(SMALL ? lage : `Läge ${lage}`);
      lt.font = Font.mediumSystemFont(SMALL ? 10 : 12);
      lt.textColor = Color.lightGray();
      lt.lineLimit = 1;
    }
    content.addSpacer(3);
  });
  if (shown.length === 0) {
    const e = content.addText("Inga avgångar just nu");
    e.font = Font.systemFont(14);
    e.textColor = Color.gray();
  }
}
content.addSpacer();

if (status) {
  const sColor = status.kind === "bad" ? new Color(PAL.y.bg)
    : status.kind === "ok" ? new Color(PAL.g.bg) : Color.gray();
  if (SMALL) {
    const srow = content.addStack();
    srow.addSpacer();
    const st = srow.addText(status.kind === "bad" ? "Störning" : stamp);
    st.font = Font.systemFont(10);
    st.textColor = status.kind === "bad" ? new Color(PAL.y.bg) : Color.gray();
    st.lineLimit = 1;
    srow.addSpacer();
  } else {
    for (const line of splitTwo(status.text, LINE_MAX).slice(0, 2)) {
      const row = content.addStack();
      row.addSpacer();
      const tx = row.addText(line);
      tx.font = Font.systemFont(10);
      tx.textColor = sColor;
      tx.lineLimit = 1;
      tx.minimumScaleFactor = 0.8;
      row.addSpacer();
    }
  }
}

if (CFG.FORCE) {
  const first = shown[0] && shown[0].d;
  const lines = [
    "TEST: " + (FDBG.join(", ") || "-"),
    "fält: " + (first ? Object.keys(first).join(",") : "-"),
    "grupper: " + shown.map(x => `${x.d.line && x.d.line.designation}=${(x.d.line && x.d.line.group_of_lines) || "-"}`).slice(0, 5).join(", "),
    "stop_point: " + (first ? JSON.stringify(first.stop_point || first.stop_area || null) : "-"),
  ];
  for (const l of lines) {
    const dt = content.addText(l.slice(0, 160));
    dt.font = Font.systemFont(7);
    dt.textColor = Color.gray();
  }
}

w.refreshAfterDate = new Date(Date.now() + 2 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
