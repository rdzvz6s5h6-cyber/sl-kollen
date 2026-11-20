// SL-kollen – pendeltåg, närmaste station (automatiskt)
// Scriptable-widget i tre storlekar: liten, medium och stor.
const LITE = 3;        // minuter försenad => gul (från 3, MTR:s gräns för punktlig)
const MYCKET = 6;     // minuter försenad => röd (från 6)
const FAMILY = config.widgetFamily || "medium";
const SMALL = FAMILY === "small";
const ROWS = FAMILY === "large" ? 6 : 3; // stor widget visar fler avgångar per håll
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

// Hämtar alla störningar för pendeltåget. null = kunde inte hämtas.
async function loadDeviations() {
  const req = new Request("https://deviations.integration.sl.se/v1/messages?transport_mode=TRAIN&future=false");
  req.timeoutInterval = 10;
  try {
    const data = await req.loadJSON();
    const code = req.response ? req.response.statusCode : 0;
    return code === 200 && Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
  }
}

// kind: "ok" (inga störningar, grön), "bad" (störning, gul), "fail" (kunde inte hämtas, grå)
// Bara störningar som uttryckligen gäller linjerna som visas. Hissar och entréer räknas inte.
function buildStatus(data, lines) {
  if (!data) return { text: "Trafikläget kunde inte hämtas", kind: "fail" };
  const ACCESS = /entré|entre|ingång|uppgång|hiss|rulltrappa|trappa|biljettspärr|spärr/i;
  const mine = data.filter(m => {
    const txt = (m.message_variants || []).map(x => `${x.header || ""} ${x.details || ""}`).join(" ");
    if (ACCESS.test(txt)) return false;
    const sc = (m.scope && m.scope.lines) || [];
    return sc.some(l => lines.includes(String(l.designation)));
  });
  if (mine.length === 0) return { text: "Inga störningar noterade för pendeltåget", kind: "ok" };
  const v = mine[0].message_variants || [];
  const sv = v.find(x => x.language === "sv") || v[0] || {};
  let t = String(sv.header || sv.details || "Störning på pendeltåget")
    .replace(/\s+/g, " ").trim();
  if (mine.length > 1) t += `\u00A0(+${mine.length - 1}\u00A0till)`;
  return { text: t, kind: "bad" };
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
  if (list.length === 0) {
    const t = col.addText("–");
    t.font = Font.systemFont(18);
    t.textColor = Color.gray();
  }
  list.slice(0, ROWS).forEach((item, idx) => {
    const { d, i } = item;
    const big = false; // alla pillar och rader lika stora, även den översta
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
const devP = loadDeviations();
if (!error && !deps) {
  deps = await fetchTrains(res.st.id);
  if (!deps) error = "Ingen kontakt";
}
const devData = await devP;
const status = buildStatus(devData, [...new Set((deps || []).map(d => String((d.line && d.line.designation) || "")))]);
const now = new Date(); // tidpunkten då informationen hämtades
const stName = res.st ? res.st.name : "";
const LINE_COLOR = "#EC619F"; // färg på listen och märket
const LINE_LETTER = "P";

// Liten widget: bara nästa avgång per håll
function smallRow(parent, title, item) {
  const h = parent.addText(title);
  h.font = Font.boldSystemFont(9);
  h.textColor = Color.gray();
  if (!item) {
    const t = parent.addText("–");
    t.font = Font.systemFont(18);
    t.textColor = Color.gray();
    return;
  }
  const row = parent.addStack();
  row.centerAlignContent();
  pill(row, item.i, true);
  row.addSpacer(5);
  const dest = row.addText(shortName(item.d.destination));
  dest.font = Font.boldSystemFont(13);
  dest.textColor = Color.white();
  dest.lineLimit = 1;
  dest.minimumScaleFactor = 0.6;
}

const w = new ListWidget();
w.backgroundColor = Color.black();
w.setPadding(0, 0, 0, 0);

// Tjock färgad header över hela bredden, med ett grått band under för kolumnrubriker
const HEAD_FG = Color.white();
const HEAD_FG_SOFT = new Color(HEAD_FG.hex, 0.8);
const HEAD_FG_RING = new Color(HEAD_FG.hex, 0.75);
const head = w.addStack();
head.backgroundColor = new Color(LINE_COLOR);
head.setPadding(6, SMALL ? 10 : 12, 6, SMALL ? 10 : 12);
head.size = new Size(0, 36); // fast höjd så att iOS inte pressar ihop headern i medium
head.centerAlignContent();

const contentW = Device.screenSize().width - 55 - 24; // uppskattad innehållsbredd
const colW = Math.floor((contentW - 9) / 2);
if (!SMALL && !error) {
  const band = w.addStack();
  band.backgroundColor = new Color("#1c1c1e");
  band.setPadding(3, 12, 3, 12);
  const bt = ["NORR", "SÖDER"];
  bt.forEach((tt, bi) => {
    if (bi) band.addSpacer(9);
    const bc = band.addStack();
    bc.size = new Size(colW, 0);
    const h = bc.addText(tt);
    h.font = Font.mediumSystemFont(10);
    h.textColor = Color.gray();
    h.lineLimit = 1;
  });
  band.addSpacer();
}

const content = w.addStack();
content.layoutVertically();
content.setPadding(4, SMALL ? 10 : 12, 4, SMALL ? 10 : 12);

const top = head;

// Märket ritas som en bild så att bokstaven hamnar exakt i mitten
function lineBadge(letter, color) {
  const N = 96;
  const dc = new DrawContext();
  dc.size = new Size(N, N);
  dc.opaque = false;
  dc.respectScreenScale = false;
  dc.setFillColor(new Color(color));
  dc.fillEllipse(new Rect(0, 0, N, N));
  dc.setStrokeColor(HEAD_FG_RING);
  dc.setLineWidth(5);
  dc.strokeEllipse(new Rect(3, 3, N - 6, N - 6));
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
t1.font = Font.boldSystemFont(SMALL ? 15 : 16);
t1.textColor = HEAD_FG;
t1.lineLimit = 1;
t1.minimumScaleFactor = 0.7;
const stamp = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
top.addSpacer();
if (!SMALL) {
  const right = top.addStack();
  right.layoutVertically();
  const ur = right.addStack();
  ur.centerAlignContent();
  ur.addSpacer();
  const ic = ur.addImage(SFSymbol.named("arrow.clockwise").image);
  ic.imageSize = new Size(10, 10);
  ic.tintColor = HEAD_FG_SOFT;
  ur.addSpacer(3);
  const t2 = ur.addText(stamp);
  t2.font = Font.systemFont(10);
  t2.textColor = HEAD_FG_SOFT;
  if (res.note) {
    const n = right.addText(res.note);
    n.font = Font.systemFont(9);
    n.textColor = HEAD_FG_SOFT;
    n.rightAlignText();
  }
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
  const body = content.addStack();
  if (SMALL) {
    body.layoutVertically();
    const nl = all.filter(x => x.d.direction_code === 2);
    const sl = all.filter(x => x.d.direction_code === 1);
    smallRow(body, "NORR", nl[0]);
    body.addSpacer(5);
    smallRow(body, "SÖDER", sl[0]);
  } else {
    column(body, "NORR", all.filter(x => x.d.direction_code === 2), colW);
    body.addSpacer(4);
    const div = body.addStack();
    div.size = new Size(1, 4 + ROWS * 23);
    div.backgroundColor = new Color("#2c2c2e");
    body.addSpacer(4);
    column(body, "SÖDER", all.filter(x => x.d.direction_code === 1), colW);
  }
}
content.addSpacer();

const sColor = status.kind === "bad" ? new Color(PAL.y.bg)
  : status.kind === "ok" ? new Color(PAL.g.bg)
  : Color.gray();
if (SMALL) {
  const srow = content.addStack();
  srow.addSpacer();
  if (status.kind !== "bad") {
    const sic = srow.addImage(SFSymbol.named("arrow.clockwise").image);
    sic.imageSize = new Size(10, 10);
    sic.tintColor = Color.gray();
    srow.addSpacer(3);
  }
  const st = srow.addText(status.kind === "bad" ? "Störning" : stamp);
  st.font = Font.systemFont(10);
  st.textColor = status.kind === "bad" ? new Color(PAL.y.bg) : Color.gray();
  st.lineLimit = 1;
  srow.addSpacer();
}
for (const line of (SMALL ? [] : splitTwo(status.text, LINE_MAX).slice(0, 2))) {
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
