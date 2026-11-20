// SL-kollen – bussar, båtar, Närmast (multi) och Hela stationen (vald). Läget styrs av laddaren (SL_LINJE): buss, bat, multi eller vald.
// Visar de närmaste avgångarna från närmaste hållplats/brygga, alla linjer och håll blandade i tidsordning.
const CONFIGS = {
  buss: {
    key: "buss", label: "bussarna", transports: ["BUS"], color: "#1E5AA8", letter: "B",
    stick: 0.15, // km: behåll senaste hållplats om du är närmare än så
    empty: "Inga bussavgångar hittades nära dig",
  },
  multi: {
    key: "multi", label: "linjerna", transports: ["ALL"], color: "#6E6E73", letter: "SL",
    stick: 0.1,
    empty: "Inga avgångar hittades nära dig",
  },
  vald: {
    key: "vald", label: "linjerna", transports: ["ALL"], color: "#6E6E73", letter: "SL",
    stick: 0,
    empty: "Inga avgångar hittades",
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
const LARGE = FAMILY === "large";
const ROWS = SMALL ? 2 : LARGE ? 10 : 3;
const MAX_FULL = 2; // stor widget: så många störningar visas i sin helhet
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

// Hämtar avgångar från en plats. tr = null hämtar alla färdsätt. null tillbaka = kunde inte hämta.
async function fetchOne(id, tr) {
  const req = new Request(`${BASE}/sites/${id}/departures${tr ? `?transport=${tr}` : ""}`);
  req.timeoutInterval = 10;
  try {
    const data = await req.loadJSON();
    const code = req.response ? req.response.statusCode : 0;
    return code === 200 && Array.isArray(data.departures) ? data.departures : null;
  } catch (e) { return null; }
}

// Alla lägen i CFG. "ALL" = alla färdsätt (multi): först i ett anrop, annars ett per färdsätt.
async function fetchDeps(id) {
  const trs = CFG.transports;
  let results;
  if (trs[0] === "ALL") {
    const all = await fetchOne(id, null);
    if (all) return all;
    results = await Promise.all(["BUS", "METRO", "TRAIN", "TRAM", "SHIP", "FERRY"].map(t => fetchOne(id, t)));
  } else {
    results = await Promise.all(trs.map(t => fetchOne(id, t)));
  }
  const ok = results.filter(r => r);
  return ok.length ? [].concat(...ok) : null;
}

// Störningar som uttryckligen gäller någon av linjerna som visas.
async function loadStatus(lines, modes) {
  const fail = { text: "Trafikläget kunde inte hämtas", kind: "fail" };
  const ACCESS = /entré|entre|ingång|uppgång|hiss|rulltrappa|trappa|biljettspärr|spärr/i;
  try {
    const all = [];
    const trs = modes || CFG.transports;
    for (const tr of trs) {
      const req = new Request(`https://deviations.integration.sl.se/v1/messages?transport_mode=${tr}&future=false`);
      req.timeoutInterval = 10;
      const data = await req.loadJSON();
      const code = req.response ? req.response.statusCode : 0;
      if (code === 200 && Array.isArray(data)) all.push(...data);
      else if (tr === trs[0]) return fail;
    }
    const mine = all.filter(m => {
      const txt = (m.message_variants || []).map(x => `${x.header || ""} ${x.details || ""}`).join(" ");
      if (ACCESS.test(txt)) return false;
      const sc = (m.scope && m.scope.lines) || [];
      return sc.some(l => lines.includes(String(l.designation)));
    });
    if (mine.length === 0) return { text: `Inga störningar noterade för ${CFG.label} här`, kind: "ok", items: [] };
    const clean = t => String(t || "").replace(/\s+/g, " ").trim();
    const items = mine.map(m => {
      const v = m.message_variants || [];
      const sv = v.find(x => x.language === "sv") || v[0] || {};
      const head = clean(sv.header), det = clean(sv.details);
      const full = head && det && !det.startsWith(head) ? `${head}: ${det}` : (det || head || "Störning");
      return { short: head || full, full: full.length > 170 ? full.slice(0, 167) + "…" : full };
    });
    let t = items[0].short;
    if (items.length > 1) t += `\u00A0(+${items.length - 1}\u00A0till)`;
    return { text: t, kind: "bad", items };
  } catch (e) { return fail; }
}

const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
async function resolve() {
  let loc = null;
  try { Location.setAccuracyToHundredMeters(); loc = await Location.current(); } catch (e) {}
  const last = readJSON(lastPath);
  if (!loc) {
    if (last) return { st: last, note: "senaste plats" };
    return { error: "Plats saknas. Kör skriptet i appen." };
  }
  if (last && last.lat !== undefined &&
      km(loc.latitude, loc.longitude, last.lat, last.lon) < CFG.stick) {
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

// Låst station. Hela stationen kräver ett namn. Buss, Båt och Närmast station har det som tillval:
// inget namn = närmaste station (resolve), namn = låst till den stationen.
// Ordning: Parameter på widgeten, STATION överst i skriptet, sparat val i appen.
async function resolveVald() {
  const OPTIONAL = CFG.key !== "vald";
  const namePath = fm.joinPath(dir, OPTIONAL ? `sl_station_${CFG.key}.txt` : "sl_vald_namn.txt");
  const PARAM = String(args.widgetParameter || "").trim();
  const FAST = typeof SL_STATION !== "undefined" ? String(SL_STATION || "").trim() : "";
  const saved = fm.fileExists(namePath) ? fm.readString(namePath).trim() : "";
  const askName = async (title) => {
    const a = new Alert();
    a.title = title;
    a.message = "Skriv namnet, till exempel Årstaberg.";
    a.addTextField("Stationens namn");
    a.addAction("Spara");
    await a.presentAlert();
    const v = String(a.textFieldValue(0) || "").trim();
    if (v) fm.writeString(namePath, v);
    return v;
  };
  let name = PARAM || FAST || saved;
  if (!config.runsInWidget && !PARAM && !FAST) {
    // Körs i appen: visa vald station och låt användaren byta eller gå tillbaka till närmaste
    if (name || OPTIONAL) {
      const m = new Alert();
      m.title = name ? `Låst station: ${name}` : "Station: närmaste (automatisk)";
      m.message = name
        ? "Widgeten på hemskärmen använder den här stationen om du inte skrivit något i dess Parameter."
        : "Widgeten väljer närmaste station. Du kan också låsa den till en egen station.";
      m.addAction("Visa widget");
      m.addAction(name ? "Byt station" : "Välj station");
      if (name && OPTIONAL) m.addAction("Närmaste station");
      const r = await m.presentAlert();
      if (r === 1) name = (await askName("Vilken station?")) || name;
      else if (r === 2) { fm.remove(namePath); name = ""; }
    } else {
      name = await askName("Vilken station?");
    }
  }
  if (!name) return OPTIONAL ? null : { error: "Ange station: håll in widgeten, Redigera widget, Parameter" };
  const n = norm(name);
  const lp = fm.joinPath(dir, `sl_last_vald_${n.replace(/[^a-z0-9åäö]/g, "_")}.json`);
  const last = readJSON(lp);
  if (last) return { st: last, note: "", locked: true };
  const sites = await loadSites();
  if (!sites) return { error: "Kör skriptet i appen en gång", locked: true };
  const words = n.split(" ").filter(Boolean);
  const rank = x => {
    const m = norm(x[1]);
    if (m === n) return 0;
    if (m.startsWith(n)) return 1;
    if (m.includes(n)) return 2;
    return words.length > 1 && words.every(w => m.includes(w)) ? 3 : 9;
  };
  const cand = sites.filter(x => rank(x) < 9)
    .sort((a, b) => rank(a) - rank(b) || String(a[1]).length - String(b[1]).length).slice(0, 5);
  if (!cand.length) return { error: `Hittade ingen station som heter "${name}"`, locked: true };
  const results = await Promise.all(cand.map(x => fetchDeps(x[0])));
  let pick = results.findIndex(r => r && r.some(d => min(new Date(d.expected || d.scheduled), new Date()) >= -1));
  if (pick < 0) pick = results.findIndex(r => r);
  if (pick < 0) return { error: `Inga avgångar hittades för "${name}"`, locked: true };
  const x = cand[pick];
  const st = { id: x[0], name: x[1], lat: x[2], lon: x[3] };
  fm.writeString(lp, JSON.stringify(st));
  return { st, deps: results[pick], note: "", locked: true };
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
function pill(parent, i, big, compact) {
  const W = compact ? 44 : big ? 56 : 50;
  const numSize = compact ? 15 : big ? 23 : 17;
  const unitSize = compact ? 8 : big ? 10 : 9;
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
const TRAM_COLORS = { "22": "#C9651A", "21": "#A5682A", "12": "#7A5C3E", "25": "#1FA3A3", "26": "#1FA3A3", "7": "#6FA33A", "7N": "#6FA33A" };
function busColor(l) {
  const blue = /blå/i.test(String(l.group_of_lines || "")) || BLUE_BUSES.includes(String(l.designation));
  return blue ? "#1E5AA8" : "#D32F2F";
}
// Roslagsbanan kommer från SL som spårvagn (TRAM), så den känns igen på namn eller linjenummer (inte buss 27/28/29).
function isRoslags(d) {
  const l = d.line || {};
  const m = String(l.transport_mode || "").toUpperCase();
  if (m !== "TRAM" && m !== "TRAIN") return false;
  return /roslags/i.test(String(l.group_of_lines || "")) || /^(27|28|28S|29)$/.test(String(l.designation));
}
function badgeColor(d) {
  const l = d.line || {};
  if (CFG.key === "buss") return busColor(l);
  if (CFG.key !== "multi" && CFG.key !== "vald") return CFG.color;
  const n = String(l.designation), g = String(l.group_of_lines || "");
  const m = String(l.transport_mode || "").toUpperCase();
  if (isRoslags(d)) return "#8E4A9E";
  if (m === "METRO") {
    if (/röd/i.test(g) || ["13", "14"].includes(n)) return "#E5322D";
    if (/grön/i.test(g) || ["17", "18", "19"].includes(n)) return "#2E9E4F";
    return "#0089CA";
  }
  if (m === "TRAIN") return (/roslags/i.test(g) || ["27", "28", "29"].includes(n)) ? "#8E4A9E" : "#EC619F";
  if (m === "TRAM") return TRAM_COLORS[n] || "#C9651A";
  if (m === "SHIP" || m === "FERRY") return "#0E8A9B";
  return busColor(l);
}
// Bokstav i märket uppe till vänster (multi: efter första avgångens färdsätt)
function modeLetter(d) {
  if (isRoslags(d)) return "R";
  const m = String(((d.line || {}).transport_mode) || "").toUpperCase();
  return { METRO: "T", TRAIN: "P", TRAM: "S", SHIP: "Bt", FERRY: "Bt", BUS: "B" }[m] || "SL";
}

// Etikett för plats-rutan: spår för tåg och tunnelbana, läge för buss, brygga för båt. Spårvagn visar ingen ruta.
function platsEtikett(d) {
  const m0 = String(((d.line || {}).transport_mode) || "").toUpperCase();
  const m = m0 || (CFG.key === "buss" ? "BUS" : CFG.key === "bat" ? "SHIP" : "");
  if (m === "TRAIN" || m === "METRO" || isRoslags(d)) return "Spår";
  if (m === "BUS") return "Läge";
  if (m === "SHIP" || m === "FERRY") return "Brygga";
  return null;
}

const res = (await resolveVald()) || await resolve();
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
let shown = all.slice(0, ROWS);
// Närmast station / Hela stationen: finns bara bussar på stationen visas bussvyn (blått B, två kolumner per läge).
const BUSVIEW = CFG.key === "buss" || ((CFG.key === "multi" || CFG.key === "vald") && all.length > 0 &&
  all.every(x => String((x.d.line || {}).transport_mode || "").toUpperCase() === "BUS"));
// Buss, medium/stor: dela upp per fysiskt stopp (läge). Varje stopp ligger på en sida av vägen, alltså en riktning.
const spKey = d => { const sp = d.stop_point || {}; return String(sp.id || sp.designation || ""); };
let groups = null;
let oneHead = "";
let heads = [];
if (BUSVIEW && !SMALL) {
  const gm = new Map();
  for (const x of all) { const k = spKey(x.d); if (!gm.has(k)) gm.set(k, []); gm.get(k).push(x); }
  const lg = g => String(((g[0].d.stop_point || {}).designation) || "").trim();
  // Rubrik: läge (om SL anger det) och linjerna som stannar vid stoppet. Lika rubriker får slutstation.
  const linesOf = g => [...new Set(g.map(x => String((x.d.line && x.d.line.designation) || "")))].sort((a, b) => a.localeCompare(b, "sv", { numeric: true }));
  // Anger SL inget läge i två kolumner namnger vi dem Läge A och Läge B (i fast ordning efter stopp-id)
  const mkHead = (g, i) => {
    const ln = linesOf(g);
    const lt = ln.length > 1 ? ln.join(", ") : `Linje ${ln[0]}`;
    if (lg(g)) return `Läge ${lg(g)} · ${lt}`;
    return i === undefined ? `Linje ${ln.join(", ")}` : `Läge ${String.fromCharCode(65 + i)} · ${lt}`;
  };
  if (!gm.has("") && gm.size === 1) {
    oneHead = mkHead([...gm.values()][0]);
  } else if (!gm.has("") && gm.size >= 2) {
    const COLROWS = LARGE ? 8 : 3;
    const gl = [...gm.values()].slice(0, 2);
    gl.sort((a, b) => lg(a).localeCompare(lg(b)) || spKey(a[0].d).localeCompare(spKey(b[0].d), "sv", { numeric: true }));
    heads = gl.map((g, i) => mkHead(g, i));
    groups = gl.map(g => g.slice(0, COLROWS));
    shown = groups.flat();
  }
}
const modeOf = d => String((d.line && d.line.transport_mode) || "").toUpperCase().replace("FERRY", "SHIP");
const statusModes = CFG.transports[0] === "ALL"
  ? [...new Set(shown.map(x => modeOf(x.d)).filter(Boolean))] : null;
const status = error ? null : await loadStatus([...new Set(shown.map(x => String(x.d.line && x.d.line.designation)))], statusModes && statusModes.length ? statusModes : null);
// Stor widget: störningar går före avgångar. Varje störning som visas helt tar ca två rader.
const fullN = LARGE && status && status.kind === "bad" ? Math.min(status.items.length, MAX_FULL) : 0;
if (fullN && groups) groups = groups.map(g => g.slice(0, Math.max(3, g.length - fullN)));
else if (fullN) shown = shown.slice(0, Math.max(3, ROWS - fullN));

// Teckenbredd (i em, SF Medium) per bokstav, så att textstorleken kan räknas ut för varje namn
const EMW = { a:.543,b:.593,c:.547,d:.593,e:.57,f:.318,g:.593,h:.585,i:.243,j:.243,k:.523,l:.243,m:.873,n:.585,o:.595,p:.593,q:.593,r:.364,s:.506,t:.355,u:.585,v:.52,w:.77,x:.507,y:.52,z:.48,"å":.543,"ä":.543,"ö":.595,"é":.57," ":.28,"-":.35,".":.28,"/":.3,
  A:.69,B:.64,C:.73,D:.76,E:.58,F:.56,G:.77,H:.75,I:.29,J:.5,K:.65,L:.54,M:.88,N:.76,O:.79,P:.62,Q:.79,R:.65,S:.63,T:.61,U:.75,V:.67,W:.98,X:.65,Y:.63,Z:.62,"Å":.69,"Ä":.69,"Ö":.79 };
function emWidth(s) {
  let t = 0;
  for (const ch of String(s)) t += EMW[ch] !== undefined ? EMW[ch] : 0.6;
  return t;
}
// Största storlek (steg om 0,5) där namnet ryms i bredden avail
function fitSize(s, avail, min, max) {
  const fs = Math.floor((avail / emWidth(s)) * 2) / 2;
  return Math.max(min, Math.min(max, fs));
}

const w = new ListWidget();
w.backgroundColor = Color.black();
w.setPadding(0, 0, 0, 0);
const first0 = shown[0] && shown[0].d;
const VALD = CFG.key === "vald";
const LOCKED = !!res.locked;
const MULTI = (CFG.key === "multi" || VALD) && !BUSVIEW;
const LOOK = BUSVIEW ? CONFIGS.buss : CFG;
const topColor = MULTI ? "#8e8e93" : LOOK.color;
const topLetter = LOOK.letter;

// Tjock färgad header över hela bredden; i tvåkolumnsläget ett grått band under med lägen
const HEAD_FG = CFG.letterColor && !MULTI && !BUSVIEW ? new Color(CFG.letterColor) : Color.white();
const HEAD_FG_SOFT = new Color(HEAD_FG.hex, 0.8);
const HEAD_FG_RING = new Color(HEAD_FG.hex, 0.75);
const head = w.addStack();
head.backgroundColor = new Color(topColor);
head.setPadding(6, SMALL ? 10 : 12, 6, SMALL ? 10 : 12);
head.size = new Size(0, 36); // fast höjd så att iOS inte pressar ihop headern i medium
head.centerAlignContent();

// Samma uppskattade widgetbredd som linjewidgetarna (skärmbredd - 55), så innehållet aldrig blir bredare än widgeten
const COLW = Math.floor((Device.screenSize().width - 44 - 24 - 13) / 2); // vänster kolumn; höger kolumn tar resten av bredden
if (groups && !error) {
  const band = w.addStack();
  band.backgroundColor = new Color("#1c1c1e");
  band.setPadding(3, 12, 3, 12);
  groups.forEach((g, gi) => {
    if (gi) band.addSpacer(13);
    const bc = band.addStack();
    if (gi === 0) bc.size = new Size(COLW, 0);
    const ht = bc.addText(heads[gi]);
    ht.font = Font.mediumSystemFont(10);
    ht.textColor = Color.gray();
    ht.lineLimit = 1;
    ht.minimumScaleFactor = 0.6;
    ht.leftAlignText();
    bc.addSpacer();
  });
  band.addSpacer();
} else if (oneHead && !error) {
  const band = w.addStack();
  band.backgroundColor = new Color("#1c1c1e");
  band.setPadding(3, 12, 3, 12);
  const ot = band.addText(oneHead);
  ot.font = Font.mediumSystemFont(10);
  ot.textColor = Color.gray();
  ot.lineLimit = 1;
  band.addSpacer();
}

const content = w.addStack();
content.layoutVertically();
content.setPadding(4, SMALL ? 10 : 12, 4, SMALL ? 10 : 12);

const top = head;

// Märket ritas som en bild så att bokstaven hamnar exakt i mitten
function modeLogo(parent, d, size) {
  const N = 96;
  const dc = new DrawContext();
  dc.size = new Size(N, N);
  dc.opaque = false;
  dc.respectScreenScale = false;
  dc.setFillColor(new Color(badgeColor(d)));
  dc.fillEllipse(new Rect(0, 0, N, N));
  dc.setStrokeColor(new Color("#ffffff", 0.6));
  dc.setLineWidth(5);
  dc.strokeEllipse(new Rect(3, 3, N - 6, N - 6));
  dc.setTextColor(Color.white());
  dc.setFont(Font.boldSystemFont(modeLetter(d).length > 1 ? 40 : 54));
  dc.setTextAlignedCenter();
  dc.drawTextInRect(modeLetter(d), new Rect(0, modeLetter(d).length > 1 ? 24 : 15, N, N - 15));
  const im = parent.addImage(dc.getImage());
  im.imageSize = new Size(size, size);
}
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
  dc.setTextColor(CFG.letterColor ? new Color(CFG.letterColor) : Color.white());
  dc.setFont(Font.boldSystemFont(letter.length > 1 ? 40 : 54));
  dc.setTextAlignedCenter();
  dc.drawTextInRect(letter, new Rect(0, letter.length > 1 ? 24 : 15, N, N - 15));
  return dc.getImage();
}
if (MULTI) {
  // Multi: neutral cirkel med symbol, så den skiljer sig från widgetarna per linje
  const bs = top.addStack();
  bs.size = new Size(24, 24);
  bs.cornerRadius = 12;
  bs.backgroundColor = new Color("#3a3a3c");
  bs.centerAlignContent();
  bs.addSpacer();
  const bi = bs.addImage(SFSymbol.named(LOCKED ? "lock.fill" : "scope").image);
  bi.imageSize = new Size(13, 13);
  bi.tintColor = Color.white();
  bs.addSpacer();
} else {
  const badge = top.addImage(lineBadge(topLetter, topColor));
  badge.imageSize = new Size(24, 24);
}
top.addSpacer(6);
const t1 = top.addText(stName);
t1.font = Font.boldSystemFont(SMALL ? 15 : 16);
t1.textColor = HEAD_FG;
t1.lineLimit = 1;
t1.minimumScaleFactor = 0.7;
const stamp = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
top.addSpacer();
if (!MULTI) {
  const modeIc = top.addImage(SFSymbol.named(LOCKED ? "lock.fill" : "scope").image);
  modeIc.imageSize = new Size(11, 11);
  modeIc.tintColor = HEAD_FG_SOFT;
  if (!SMALL) top.addSpacer(8);
}
if (!SMALL) {
  if (MULTI) {
    const tg = top.addStack();
    tg.backgroundColor = new Color("#2c2c2e");
    tg.cornerRadius = 9;
    tg.setPadding(2, 7, 2, 7);
    tg.centerAlignContent();
    const ti = tg.addImage(SFSymbol.named(LOCKED ? "lock.fill" : "scope").image);
    ti.imageSize = new Size(11, 11);
    ti.tintColor = Color.lightGray();
    tg.addSpacer(3);
    const tt = tg.addText(LOCKED ? "Fast" : "Närmast");
    tt.font = Font.mediumSystemFont(11);
    tt.textColor = Color.lightGray();
    tt.lineLimit = 1;
    top.addSpacer(6);
  }
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
}
content.addSpacer(3);

if (error) {
  const e = content.addText(error);
  e.font = Font.systemFont(13);
  e.textColor = Color.orange();
} else if (groups) {
  const colW = COLW;
  const maxN = Math.max(...groups.map(g => g.length));
  const cols = content.addStack();
  cols.topAlignContent();
  groups.forEach((g, gi) => {
    if (gi) {
      cols.addSpacer(6);
      const dv = cols.addStack();
      dv.backgroundColor = new Color("#3a3a3c");
      dv.size = new Size(1, maxN * 27 + 4);
      cols.addSpacer(6);
    }
    const col = cols.addStack();
    col.layoutVertically();
    if (gi === 0) col.size = new Size(colW, 0);
    g.forEach(({ d, i }) => {
      const row = col.addStack();
      row.centerAlignContent();
      const num = String((d.line && d.line.designation) || "");
      const bw = num.length > 3 ? 42 : 34;
      const lb = row.addStack();
      lb.backgroundColor = new Color(badgeColor(d));
      lb.cornerRadius = 5;
      lb.size = new Size(bw, 20);
      lb.centerAlignContent();
      lb.addSpacer();
      const nt = lb.addText(num);
      nt.font = Font.boldSystemFont(12);
      nt.textColor = Color.white();
      nt.lineLimit = 1;
      nt.minimumScaleFactor = 0.7;
      lb.addSpacer();
      row.addSpacer(5);
      const MINW = 40;
      const ds = row.addStack();
      const dsW = colW - bw - MINW - 13;
      ds.size = new Size(dsW, 0);
      const dName = shortName(d.destination);
      // Storlek efter ordets verkliga bredd (tabell per bokstav), verklig bredd ≈ 1,05 × tabellen, därför 0,9. Korta namn stort, långa mindre.
      // AUTOFIT: sant = alla namn storlek 15 och iOS krymper de långa själv. Falskt = storleken räknas ut i förväg.
      const AUTOFIT = false;
      const dFs = AUTOFIT ? 15 : fitSize(dName, dsW * 0.9, 9, 14);
      const dt = ds.addText(dName);
      dt.font = Font.mediumSystemFont(dFs);
      dt.textColor = Color.white();
      dt.lineLimit = 1;
      dt.minimumScaleFactor = AUTOFIT ? 0.6 : 0.65;
      dt.leftAlignText();
      // Ingen spacer: den åt upp ca 9 pt av bredden (uppmätt). Vänsterställ med högerpadding.
      if (!AUTOFIT) ds.setPadding(0, 0, 0, Math.max(0, Math.round(dsW - emWidth(dName) * dFs * 1.06)));
      row.addSpacer(); // flexibel: minuterna hamnar vid kolumnens högerkant
      // Minuter som färgad text: grön i tid, gul 3+ min sen, röd 6+ min sen eller inställd
      const ms = row.addStack();
      ms.size = new Size(MINW, 0);
      ms.centerAlignContent();
      ms.addSpacer();
      const mc = new Color(PAL[i.level].bg);
      const lab = i.cancelled ? "Inst." : i.left <= 0 ? "Nu" : String(i.left);
      const mt = ms.addText(lab);
      mt.font = Font.boldSystemFont(i.cancelled ? 10 : 14);
      mt.textColor = mc;
      mt.lineLimit = 1;
      mt.minimumScaleFactor = 0.7;
      if (!i.cancelled && i.left > 0) {
        ms.addSpacer(1);
        const mu = ms.addText("min");
        mu.font = Font.boldSystemFont(8);
        mu.textColor = mc;
      }
      col.addSpacer(5);
    });
  });
} else {
  // Stor widget: två kolumner av rader skulle bli trångt, så en lista över hela bredden.
  shown.forEach((item, idx) => {
    const { d, i } = item;
    const sp0 = d.stop_point || {};
    const lage0 = String(sp0.designation || (d.stop && d.stop.designation) || d.stop_point_designation || "").trim();
    if (SMALL) {
      // liten widget: minuter till vänster, till höger linjenummer + läge och under dem slutstationen
      const row = content.addStack();
      row.centerAlignContent();
      pill(row, i, true);
      row.addSpacer(6);
      const right = row.addStack();
      right.layoutVertically();
      const top2 = right.addStack();
      top2.centerAlignContent();
      const num0 = String((d.line && d.line.designation) || "");
      if (MULTI) { modeLogo(top2, d, 18); top2.addSpacer(3); }
      const lb0 = top2.addStack();
      lb0.backgroundColor = new Color(badgeColor(d));
      lb0.cornerRadius = 6;
      lb0.size = new Size(num0.length > 3 ? 46 : 38, 20);
      lb0.centerAlignContent();
      lb0.addSpacer();
      const nt0 = lb0.addText(num0);
      nt0.font = Font.boldSystemFont(12);
      nt0.textColor = Color.white();
      nt0.lineLimit = 1;
      nt0.minimumScaleFactor = 0.7;
      lb0.addSpacer();
      if (!MULTI && lage0 && platsEtikett(d)) {
        top2.addSpacer(4);
        const lg0 = top2.addStack();
        lg0.backgroundColor = new Color("#2c2c2e");
        lg0.cornerRadius = 6;
        lg0.size = new Size(22, 20);
        lg0.centerAlignContent();
        lg0.addSpacer();
        const lt0 = lg0.addText(lage0);
        lt0.font = Font.mediumSystemFont(12);
        lt0.textColor = Color.lightGray();
        lt0.lineLimit = 1;
        lg0.addSpacer();
      }
      // Multi/Närmast/Hela stationen: slutstationen och läget i grått delar raden under loggan
      const dr = MULTI ? right.addStack() : right;
      if (MULTI) dr.centerAlignContent();
      const dest0 = dr.addText(shortName(d.destination));
      dest0.font = Font.mediumSystemFont(11);
      dest0.textColor = Color.white();
      dest0.lineLimit = 1;
      dest0.minimumScaleFactor = 0.6;
      if (MULTI && lage0 && platsEtikett(d)) {
        dr.addSpacer(4);
        const lg1 = dr.addStack();
        lg1.backgroundColor = new Color("#2c2c2e");
        lg1.cornerRadius = 5;
        lg1.setPadding(1, 5, 1, 5);
        const lt1 = lg1.addText(lage0);
        lt1.font = Font.mediumSystemFont(10);
        lt1.textColor = Color.lightGray();
        lt1.lineLimit = 1;
      }
      content.addSpacer(4);
      return;
    }
    const big = false; // alla pillar och rader lika stora, även den översta
    const row = content.addStack();
    row.centerAlignContent();
    pill(row, i, big);
    row.addSpacer(big ? 5 : 11); // översta pillen är bredare; lika startpunkt för linjenumren
    // linjenummer i en liten färgad ruta (fast bredd, siffrorna centrerade)
    const num = String((d.line && d.line.designation) || "");
    if (MULTI && !SMALL) { modeLogo(row, d, 24); row.addSpacer(4); }
    const NW = SMALL ? 38 : (num.length > 3 ? 52 : 44);
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
    const sp = d.stop_point || {};
    const lage = String(sp.designation || (d.stop && d.stop.designation) || d.stop_point_designation || "").trim();
    const destFont = big ? Font.boldSystemFont(16) : Font.mediumSystemFont(15);
    if (SMALL) {
      // liten widget: ingen plats bredvid, så slutstationen står under raden och läget är en bokstav
      row.addSpacer();
      if (lage) {
        const lg = row.addStack();
        lg.backgroundColor = new Color("#2c2c2e");
        lg.cornerRadius = 6;
        lg.size = new Size(22, 20);
        lg.centerAlignContent();
        lg.addSpacer();
        const lt = lg.addText(lage);
        lt.font = Font.mediumSystemFont(12);
        lt.textColor = Color.lightGray();
        lt.lineLimit = 1;
        lg.addSpacer();
      }
      const dest = content.addText(shortName(d.destination));
      dest.font = Font.mediumSystemFont(11);
      dest.textColor = Color.lightGray();
      dest.lineLimit = 1;
      dest.minimumScaleFactor = 0.7;
    } else {
      row.addSpacer(5);
      const dest = row.addText(shortName(d.destination));
      dest.font = destFont;
      dest.textColor = Color.white();
      dest.lineLimit = 1;
      dest.minimumScaleFactor = 1;
      if (lage && platsEtikett(d) && !oneHead) {
        row.addSpacer();
        const lg = row.addStack();
        lg.backgroundColor = new Color("#2c2c2e");
        lg.cornerRadius = 6;
        lg.setPadding(2, 6, 2, 6);
        const lt = lg.addText(`${platsEtikett(d)} ${lage}`);
        lt.font = Font.mediumSystemFont(12);
        lt.textColor = Color.lightGray();
        lt.lineLimit = 1;
      }
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
    if (status.kind === "bad") {
      const sb = srow.addText("Störning");
      sb.font = Font.systemFont(10);
      sb.textColor = new Color(PAL.y.bg);
      sb.lineLimit = 1;
      srow.addSpacer(6);
    }
    const sic = srow.addImage(SFSymbol.named("arrow.clockwise").image);
    sic.imageSize = new Size(10, 10);
    sic.tintColor = Color.gray();
    srow.addSpacer(3);
    const st = srow.addText(stamp);
    st.font = Font.systemFont(10);
    st.textColor = Color.gray();
    st.lineLimit = 1;
    srow.addSpacer();
  } else if (fullN) {
    content.addSpacer(2);
    status.items.slice(0, fullN).forEach(it => {
      const tx = content.addText(it.full);
      tx.font = Font.systemFont(10);
      tx.textColor = sColor;
      tx.lineLimit = 3;
      content.addSpacer(3);
    });
    if (status.items.length > fullN) {
      const more = content.addText(`+${status.items.length - fullN}\u00A0till`);
      more.font = Font.systemFont(10);
      more.textColor = sColor;
    }
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

w.refreshAfterDate = new Date(Date.now() + 2 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
