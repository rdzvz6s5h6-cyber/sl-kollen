// SL – pendeltåg, närmaste station (automatiskt)
// Scriptable-widget (medium). Version 2026-11-18b: färgpiller, hero-rad, trafikläge i två rader.
const LITE = 6;        // minuter försenad => gul (6–10)
const MYCKET = 11;     // minuter försenad => röd (över 10)
const ROWS = 3;
const CANDIDATES = 20;
const LINE_MAX = 50;   // tecken per rad i trafikläget
const BASE = "https://transport.integration.sl.se/v1";
const PAL = {
  g: { bg: "#30D158", fg: "#05310F" },
  y: { bg: "#FFD60A", fg: "#3A2F00" },
  r: { bg: "#FF453A", fg: "#3B0A07" },
};

const fm = FileManager.local();
const dir = fm.documentsDirectory();
const sitesPath = fm.joinPath(dir, "sl_sites.json");
const lastPath = fm.joinPath(dir, "sl_last_station.json");
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

async function fetchTrains(id) {
  const req = new Request(`${BASE}/sites/${id}/departures?transport=TRAIN`);
  req.timeoutInterval = 10;
  try {
    const data = await req.loadJSON();
    const code = req.response ? req.response.statusCode : 0;
    if (code !== 200 || !data.departures) return null;
    return data.departures;
  } catch (e) {
    return null;
  }
}

// kind: "ok" (inga störningar, grön), "bad" (störning, gul), "fail" (kunde inte hämtas, grå)
async function loadStatus() {
  const req = new Request("https://deviations.integration.sl.se/v1/messages?transport_mode=TRAIN&future=false");
  req.timeoutInterval = 10;
  const fail = { text: "Trafikläget kunde inte hämtas", kind: "fail" };
  try {
    const data = await req.loadJSON();
    const code = req.response ? req.response.statusCode : 0;
    if (code !== 200 || !Array.isArray(data)) return fail;
    if (data.length === 0) {
      return { text: "Inga störningar noterade för pendeltåget", kind: "ok" };
    }
    const v = data[0].message_variants || [];
    const sv = v.find(x => x.language === "sv") || v[0] || {};
    let t = String(sv.header || sv.details || "Störning på pendeltåget")
      .replace(/\s+/g, " ").trim();
    if (data.length > 1) t += ` (+${data.length - 1} till)`;
    return { text: t, kind: "bad" };
  } catch (e) {
    return fail;
  }
}

async function resolve() {
  let loc = null;
  try {
    Location.setAccuracyToHundredMeters();
    loc = await Location.current();
  } catch (e) {}
  const last = readJSON(lastPath);

  if (!loc) {
    const st = last || { id: 9529, name: "Älvsjö" };
    return { st, note: last ? "senaste plats" : "plats saknas" };
  }
  if (last && last.lat !== undefined &&
      km(loc.latitude, loc.longitude, last.lat, last.lon) < 0.4) {
    return { st: last, note: "" };
  }

  const sites = await loadSites();
  if (!sites) {
    if (last) return { st: last, note: "senaste plats" };
    return { error: "Kör skriptet i appen en gång" };
  }

  const near = sites
    .map(s => ({ s, d: km(loc.latitude, loc.longitude, s[2], s[3]) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, CANDIDATES);
  const results = await Promise.all(near.map(x => fetchTrains(x.s[0])));
  for (let i = 0; i < near.length; i++) {
    if (results[i] && results[i].length > 0) {
      const s = near[i].s;
      const st = { id: s[0], name: s[1], lat: s[2], lon: s[3] };
      fm.writeString(lastPath, JSON.stringify(st));
      return { st, deps: results[i], note: "" };
    }
  }
  if (last) return { st: last, note: "senaste plats" };
  return { error: "Ingen pendeltågsstation nära" };
}

function info(d, now) {
  const exp = new Date(d.expected);
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

function column(parent, title, list, colW) {
  const col = parent.addStack();
  col.layoutVertically();
  col.size = new Size(colW, 0);
  const h = col.addText(title);
  h.font = Font.boldSystemFont(10);
  h.textColor = Color.gray();
  col.addSpacer(2);
  if (list.length === 0) {
    const t = col.addText("–");
    t.font = Font.systemFont(18);
    t.textColor = Color.gray();
  }
  list.slice(0, ROWS).forEach((item, idx) => {
    const { d, i } = item;
    const big = idx === 0;
    const row = col.addStack();
    row.centerAlignContent();
    pill(row, i, big);
    row.addSpacer(5);
    const dest = row.addText(shortName(d.destination));
    dest.font = big ? Font.boldSystemFont(16) : Font.mediumSystemFont(15);
    dest.textColor = Color.white();
    dest.lineLimit = 1;
    dest.minimumScaleFactor = 0.6;
    col.addSpacer(3);
  });
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

const res = await resolve();
let deps = res.deps;
let error = res.error;
const statusP = loadStatus();
if (!error && !deps) {
  deps = await fetchTrains(res.st.id);
  if (!deps) error = "Ingen kontakt";
}
const status = await statusP;
const now = new Date(); // tidpunkten då informationen hämtades
const stName = res.st ? res.st.name : "";
const LINE_COLOR = "#EC619F"; // färg på listen och märket
const LINE_LETTER = "P";

const w = new ListWidget();
w.backgroundColor = Color.black();
w.setPadding(0, 0, 0, 0);

// Färgad list överst, över hela bredden
const bar = w.addStack();
bar.size = new Size(0, 5);
bar.backgroundColor = new Color(LINE_COLOR);
bar.addSpacer();

const content = w.addStack();
content.layoutVertically();
content.setPadding(6, 12, 4, 12);

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
  dc.setTextColor(Color.white());
  dc.setFont(Font.boldSystemFont(54));
  dc.setTextAlignedCenter();
  dc.drawTextInRect(letter, new Rect(0, 15, N, N - 15));
  return dc.getImage();
}
const badge = top.addImage(lineBadge(LINE_LETTER, LINE_COLOR));
badge.imageSize = new Size(24, 24);
top.addSpacer(6);
const t1 = top.addText(stName);
t1.font = Font.boldSystemFont(16);
t1.textColor = Color.white();
t1.lineLimit = 1;
t1.minimumScaleFactor = 0.7;
top.addSpacer();
const right = top.addStack();
right.layoutVertically();
const stamp = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
content.addSpacer(3);

if (error) {
  const e = content.addText(error);
  e.font = Font.systemFont(13);
  e.textColor = Color.orange();
} else {
  const all = deps
    .map(d => ({ d, i: info(d, now) }))
    .filter(x => x.i.left >= -1)
    .sort((a, b) => a.i.exp - b.i.exp);
  const contentW = Device.screenSize().width - 55 - 24; // uppskattad innehållsbredd
  const body = content.addStack();
  if (config.widgetFamily === "small") {
    column(body, "NORR", all.filter(x => x.d.direction_code === 2), contentW);
  } else {
    const colW = Math.floor((contentW - 9) / 2);
    column(body, "NORR", all.filter(x => x.d.direction_code === 2), colW);
    body.addSpacer(4);
    const div = body.addStack();
    div.size = new Size(1, 90);
    div.backgroundColor = new Color("#2c2c2e");
    body.addSpacer(4);
    column(body, "SÖDER", all.filter(x => x.d.direction_code === 1), colW);
  }
}
content.addSpacer();

const sColor = status.kind === "bad" ? new Color(PAL.y.bg)
  : status.kind === "ok" ? new Color(PAL.g.bg)
  : Color.gray();
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

w.refreshAfterDate = new Date(Date.now() + 2 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
