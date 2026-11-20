// SL-kollen – en widget för flera linjer. Vilken linje styrs av laddaren (SL_LINJE):
// roda, gron, bla (tunnelbana), roslagsbanan, tvarbanan, lidingobanan, nockebybanan, saltsjobanan, sparvagcity, gul.
// Alla linjer är provade mot riktig data.
const LITE = 3;        // minuter försenad => gul (3–5)  (obekräftad gräns)
const MYCKET = 6;      // minuter försenad => röd (6 eller mer)

// ---- Inställningar per linje ----
// transport: läge i SL:s API. group: matchar line.group_of_lines. nums: linjenummer.
// north/south: regex mot slutstationens namn. titles: rubrik över kolumnerna.
// names: stationer (gemener) att välja bland först; finns ingen används de 20 närmaste platserna.
// strict: räkna bara störningar som uttryckligen gäller linjen.
const CONFIGS = {
  roda: {
    key: "roda", label: "röda linjen", transport: "METRO", strict: false,
    group: /röda/i, nums: ["13", "14"], color: "#E5322D", letter: "T",
    titles: ["NORR", "SÖDER"], north: /ropsten|mörby/i, south: /norsborg|fruängen/i,
    names: ["ropsten", "gärdet", "karlaplan", "östermalmstorg", "t-centralen", "gamla stan",
      "slussen", "mariatorget", "zinkensdamm", "hornstull", "liljeholmen", "aspudden",
      "örnsberg", "axelsberg", "mälarhöjden", "bredäng", "sätra", "skärholmen", "vårberg",
      "vårby gård", "masmo", "fittja", "alby", "hallunda", "norsborg", "midsommarkransen",
      "telefonplan", "hägerstensåsen", "västertorp", "fruängen", "tekniska högskolan",
      "stadion", "universitetet", "bergshamra", "danderyds sjukhus", "mörby centrum"],
  },
  gron: {
    key: "gron", label: "gröna linjen", transport: "METRO", strict: false,
    group: /gröna/i, nums: ["17", "18", "19"], color: "#2E9E4F", letter: "T",
    titles: ["NORR", "SÖDER"], north: /åkeshov|alvik|hässelby/i, south: /skarpnäck|farsta|hagsätra/i,
    names: ["hässelby strand", "hässelby gård", "johannelund", "vällingby", "råcksta", "blackeberg",
      "islandstorget", "ängbyplan", "åkeshov", "brommaplan", "abrahamsberg", "stora mossen",
      "alvik", "kristineberg", "thorildsplan", "fridhemsplan", "rådhuset", "t-centralen",
      "hötorget", "rådmansgatan", "odenplan", "sankt eriksplan", "s:t eriksplan", "slussen",
      "medborgarplatsen", "skanstull", "gullmarsplan", "globen", "enskede gård", "sockenplan",
      "svedmyra", "stureby", "bandhagen", "högdalen", "rågsved", "hagsätra", "blåsut",
      "sandsborg", "skogskyrkogården", "tallkrogen", "gubbängen", "hökarängen", "farsta",
      "farsta strand", "björkhagen", "kärrtorp", "bagarmossen", "skarpnäck"],
  },
  bla: {
    key: "bla", label: "blå linjen", transport: "METRO", strict: false,
    group: /blå/i, nums: ["10", "11"], color: "#0089CA", letter: "T",
    titles: ["NORR", "SÖDER"], north: /akalla|hjulsta/i, south: /kungsträdgården/i,
    names: ["kungsträdgården", "t-centralen", "rådhuset", "fridhemsplan", "stadshagen",
      "västra skogen", "solna centrum", "näckrosen", "hallonbergen", "rinkeby", "tensta",
      "hjulsta", "kista", "husby", "akalla", "solna strand", "huvudsta"],
  },
  roslagsbanan: {
    key: "roslagsbanan", label: "Roslagsbanan", transport: "TRAIN", fetchModes: ["TRAIN", "TRAM"], strict: true,
    group: /roslags/i, nums: ["27", "28", "28S", "29"], color: "#8E4A9E", letter: "R",
    titles: ["NORR", "SÖDER"], north: /kårsta|österskär|näsbypark/i, south: /östra|stockholm/i,
    names: ["stockholms östra", "universitetet", "tekniska högskolan", "stockholms östra",
      "mörby", "danderyds sjukhus", "djursholms ösby", "ösby", "stocksund", "altorp", "enebyberg",
      "näsbypark", "näsby allé", "täby kyrkby", "visinge", "viggbyholm", "österskär", "åkersberga",
      "kårsta", "lindholmen", "rydbo", "bråtorp", "tibble", "roslags näsby", "galoppfältet",
      "ropsten", "gamla enebyberg", "mörby centrum", "täby centrum", "hägernäs", "ensta", "frösunda",
      "vallentuna", "ormsta", "molnby", "lindholmen", "össeby", "markim", "rimbo"],
  },
  tvarbanan: {
    key: "tvarbanan", label: "Tvärbanan", transport: "TRAM", strict: true,
    group: /tvär/i, nums: ["22"], color: "#C9651A", letter: "Tv",
    titles: ["MOT SOLNA / ALVIK", "MOT SICKLA"], north: /alvik|solna/i, south: /sickla|gullmarsplan|liljeholmen/i,
    names: ["alvik", "stora essingen", "gröndal", "årsta", "lindhagensplan", "liljeholmen",
      "årstadal", "årstaberg", "årstaberg", "johannesfred", "sofia", "hammarby", "sickla",
      "sickla kaj", "sickla udde", "gullmarsplan", "solna station", "solna business park",
      "ulvsunda", "bromsten", "mariehäll", "hägersten", "kungsholmen", "ropsten", "lövholmen",
      "trekanten", "luma", "aspudden", "norra hammarbyhamnen", "globen", "sicklas"],
  },
  lidingobanan: {
    key: "lidingobanan", label: "Lidingöbanan", transport: "TRAM", strict: true,
    group: /liding/i, nums: ["21"], color: "#A5682A", letter: "L",
    titles: ["MOT LIDINGÖ", "MOT ROPSTEN"], north: /gåshaga|lidingö|larsberg|baggeby/i, south: /ropsten/i,
    names: ["ropsten", "torsvik", "bodal", "larsberg", "baggeby", "gåshaga brygga", "gåshaga",
      "kottla", "elfviksvägen", "bosund", "käppala", "lidingö centrum", "dalénum", "högberga"],
  },
  nockebybanan: {
    key: "nockebybanan", label: "Nockebybanan", transport: "TRAM", strict: true,
    group: /nockeby/i, nums: ["12"], color: "#7A5C3E", letter: "N",
    titles: ["MOT NOCKEBY", "MOT ALVIK"], north: /nockeby|smedslätten|bromma/i, south: /alvik/i,
    names: ["alvik", "ålstensgatan", "höglandstorget", "ålsten", "kyrkbacken", "smedslätten",
      "gröndal", "nockeby torg", "nockeby", "tranebergs strand", "bromma kyrka", "johannesdal",
      "brommaplan", "ålstens gård", "ålstensbron"],
  },
  saltsjobanan: {
    key: "saltsjobanan", label: "Saltsjöbanan", transport: "TRAM", strict: true,
    group: /saltsj/i, nums: ["25", "26"], color: "#1FA3A3", letter: "S",
    titles: ["MOT SALTSJÖBADEN", "MOT SLUSSEN"], north: /saltsjöbaden|solsidan|igelboda|neglinge|fisksätra/i, south: /slussen|henriksdal|sickla/i,
    names: ["slussen", "henriksdal", "sickla", "saltsjö-järla", "järla", "fisksätra", "neglinge",
      "saltsjö-duvnäs", "östervik", "saltsjöbaden", "storängen", "lillängen", "igelboda", "tippen",
      "erstavik", "skuru", "solsidan", "dalénum"],
  },
  gul: {
    key: "gul", label: "gula linjen", transport: "METRO", strict: true,
    group: /gul/i, nums: [], color: "#F5B800", letterColor: "#1A1A1A", letter: "T",
    titles: ["NORR", "SÖDER"], north: /fridhemsplan/i, south: /älvsjö/i,
    notOpen: "Gula linjen (Fridhemsplan–Älvsjö) har inte öppnat än. Widgeten börjar fungera av sig själv när SL visar avgångar.",
    names: ["fridhemsplan", "liljeholmen", "årstaberg", "årstafältet", "östbergahöjden", "älvsjö"],
  },
  sparvagcity: {
    key: "sparvagcity", label: "Spårväg City", transport: "TRAM", strict: true,
    group: /spårväg city|djurgård|city/i, nums: ["7", "7N"], color: "#6FA33A", letter: "7",
    titles: ["MOT DJURGÅRDEN", "MOT T-CENTRALEN"], north: /waldemarsudde|bellmansro|djurgård|skansen|gröna lund/i, south: /t-centralen|sergels|centralen/i,
    names: ["t-centralen", "hamngatan", "nybroplan", "djurgårdsbron", "nordiska museet", "gröna lund",
      "skansen", "liljevalchs", "djurgården", "waldemarsudde", "bellmansro", "norrmalmstorg"],
  },
};
const CFG = CONFIGS[typeof SL_LINJE !== "undefined" ? SL_LINJE : "roda"] || CONFIGS.roda;
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

const SEEN = new Set();   // linjer som SL visade på provade stationer (visas bara i appen vid fel)
const TRIED = [];          // stationer som provats
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const isRed = d => {
  const l = d.line || {};
  return CFG.group.test(l.group_of_lines || "") || CFG.nums.includes(String(l.designation));
};

// Returnerar bara röda linjens avgångar. null = kunde inte hämta.
async function fetchOne(id, mode) {
  const req = new Request(`${BASE}/sites/${id}/departures?transport=${mode}`);
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

// Returnerar bara linjens avgångar. null = kunde inte hämta.
// Roslagsbanan rapporteras av SL som både TRAIN och TRAM, så den frågar båda.
async function fetchTrains(id) {
  const parts = await Promise.all((CFG.fetchModes || [CFG.transport]).map(m => fetchOne(id, m)));
  const ok = parts.filter(p => p);
  if (!ok.length) return null;
  const all = [].concat(...ok);
  all.forEach(d => {
    const l = d.line || {};
    SEEN.add(`${l.designation || "?"}/${l.group_of_lines || "?"}`);
  });
  return all.filter(isRed);
}

// kind: "ok" (inga störningar, grön), "bad" (störning, gul), "fail" (kunde inte hämtas, grå)
async function loadStatus() {
  const req = new Request(`https://deviations.integration.sl.se/v1/messages?transport_mode=${CFG.transport}&future=false`);
  req.timeoutInterval = 10;
  const fail = { text: "Trafikläget kunde inte hämtas", kind: "fail" };
  try {
    const data = await req.loadJSON();
    const code = req.response ? req.response.statusCode : 0;
    if (code !== 200 || !Array.isArray(data)) return fail;
    // Behåll störningar som rör röda linjen. Saknas info om linje räknas den som relevant.
    // Hoppa över meddelanden om entréer, hissar och trappor – de stoppar inte tågen.
    const ACCESS = /entré|entre|ingång|uppgång|hiss|rulltrappa|trappa|biljettspärr|spärr/i;
    const isAccess = m => (m.message_variants || [])
      .some(x => ACCESS.test(`${x.header || ""} ${x.details || ""}`));
    const red = data.filter(m => !isAccess(m)).filter(m => {
      const lines = (m.scope && m.scope.lines) || [];
      if (lines.length === 0) return !CFG.strict;
      return lines.some(l => CFG.group.test(l.group_of_lines || "") ||
        CFG.nums.includes(String(l.designation)));
    });
    if (red.length === 0) {
      return { text: `Inga störningar noterade för ${CFG.label}`, kind: "ok" };
    }
    const v = red[0].message_variants || [];
    const sv = v.find(x => x.language === "sv") || v[0] || {};
    let t = String(sv.header || sv.details || `Störning på ${CFG.label}`)
      .replace(/\s+/g, " ").trim();
    if (red.length > 1) t += `\u00A0(+${red.length - 1}\u00A0till)`;
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
    if (last) return { st: last, note: "senaste plats" };
    return { error: "Plats saknas. Kör skriptet i appen." };
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

  const byDist = list => list
    .map(s => ({ s, d: km(loc.latitude, loc.longitude, s[2], s[3]) }))
    .sort((a, b) => a.d - b.d);

  // 1) närmaste stationer vars namn finns på linjen, 2) annars de 20 närmaste platserna
  const named = byDist(sites.filter(s => CFG.names.includes(norm(s[1])))).slice(0, 10);
  const any = byDist(sites).slice(0, CANDIDATES);
  for (const group of [named, any]) {
    group.slice(0, 3).forEach(x => TRIED.push(x.s[1]));
    const results = await Promise.all(group.map(x => fetchTrains(x.s[0])));
    for (let i = 0; i < group.length; i++) {
      if (results[i] && results[i].length > 0) {
        const s = group[i].s;
        const st = { id: s[0], name: s[1], lat: s[2], lon: s[3] };
        fm.writeString(lastPath, JSON.stringify(st));
        return { st, deps: results[i], note: "" };
      }
    }
  }
  if (last) return { st: last, note: "senaste plats" };
  return { error: CFG.notOpen || `Ingen station för ${CFG.label} hittades` };
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
function pill(parent, i, big, narrow) {
  const W = narrow ? 38 : big ? 56 : 50;
  const numSize = big ? 23 : 17;
  const unitSize = big ? 10 : 9;
  const RIGHT_INSET = 6;
  let label, unit = null;
  if (i.cancelled) label = "Inst.";
  else if (i.left <= 0) label = "Nu";
  else { label = String(i.left); unit = narrow ? null : "min"; } // smal pill (kolumner): bara siffran
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
    pill(row, i, big, true);
    row.addSpacer(4);
    const dName = shortName(d.destination);
    const lineNo = String((d.line && d.line.designation) || "");
    const spar = String((d.stop_point && d.stop_point.designation) || "").trim();
    // Linjenummer-bricka (24) före destinationen och spår-ruta (16) efter. Destinationen får resten, storlek räknas ut efter bredd.
    if (lineNo) {
      const lb = row.addStack();
      lb.size = new Size(24, 16);
      lb.cornerRadius = 4;
      lb.backgroundColor = new Color(CFG.color);
      lb.centerAlignContent();
      const lfs = lineNo.length > 2 ? 9 : 10;
      // Centreras med marginal, inte mellanrum: iOS pressar ihop text i små rutor med mellanrum
      lb.setPadding(0, Math.max(1, Math.round((24 - lineNo.length * lfs * 0.62) / 2)), 0, 0);
      const lt = lb.addText(lineNo);
      lt.font = Font.boldSystemFont(lfs);
      lt.textColor = CFG.letterColor ? new Color(CFG.letterColor) : Color.white();
      lt.lineLimit = 1;
      row.addSpacer(3);
    }
    const destW = colW - 38 - 4 - (lineNo ? 27 : 0) - (spar ? 19 : 0);
    const dFs = fitSize(dName, destW * 0.97, 8.5, 15);
    const ds = row.addStack();
    ds.size = new Size(destW, 0);
    const dest = ds.addText(dName);
    dest.font = Font.mediumSystemFont(dFs);
    dest.textColor = Color.white();
    dest.lineLimit = 1;
    dest.minimumScaleFactor = 0.8; // bara säkerhetsnät om namnet ändå är för brett
    dest.leftAlignText();
    ds.addSpacer();
    if (spar) {
      row.addSpacer(3);
      const sb = row.addStack();
      sb.size = new Size(16, 15);
      sb.cornerRadius = 4;
      sb.backgroundColor = new Color("#2c2c2e");
      sb.centerAlignContent();
      const sfs = spar.length > 1 ? 9 : 10;
      sb.setPadding(0, Math.max(1, Math.round((16 - spar.length * sfs * 0.62) / 2 - 1.5)), 0, 0);
      const st = sb.addText(spar);
      st.font = Font.boldSystemFont(sfs);
      st.textColor = new Color("#aeaeb2");
      st.lineLimit = 1;
    }
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

// Första kolumnen = norr/väster, andra = söder/öster. Slutstationens namn avgör, annars direction_code.
function isNorth(d) {
  const n = norm(d.destination);
  if (CFG.north.test(n)) return true;
  if (CFG.south.test(n)) return false;
  return d.direction_code === 2;
}

// Valfri låst station. Ordning: Parameter på widgeten, STATION överst i skriptet, sparat val i appen.
// Inget valt = närmaste station (automatiskt). Låst visas med ett lås i headern, automatiskt med en måltavla.
async function resolveFixed() {
  const KEY = CFG.key;
  const LABEL = CFG.label;
  const namePath = fm.joinPath(dir, `sl_station_${KEY}.txt`);
  const PARAM = String(args.widgetParameter || "").trim();
  const CONST = typeof SL_STATION !== "undefined" ? String(SL_STATION || "").trim() : "";
  const saved = fm.fileExists(namePath) ? fm.readString(namePath).trim() : "";
  let name = PARAM || CONST || saved;
  if (!config.runsInWidget && !PARAM && !CONST) {
    const m = new Alert();
    m.title = saved ? `Låst station: ${saved}` : "Station: närmaste (automatisk)";
    m.message = saved
      ? "Widgeten på hemskärmen visar den här stationen om du inte skrivit något i dess Parameter."
      : "Widgeten väljer närmaste station. Du kan också låsa den till en egen station.";
    m.addAction("Visa widget");
    m.addAction("Välj station");
    if (saved) m.addAction("Närmaste station");
    const r = await m.presentAlert();
    if (r === 1) {
      const a = new Alert();
      a.title = "Vilken station?";
      a.message = "Skriv namnet, till exempel Stockholms östra.";
      a.addTextField("Stationens namn");
      a.addAction("Spara");
      await a.presentAlert();
      const v = String(a.textFieldValue(0) || "").trim();
      if (v) { fm.writeString(namePath, v); name = v; }
    } else if (r === 2) {
      fm.remove(namePath);
      name = "";
    }
  }
  if (!name) return null;
  const n = norm(name);
  const lp = fm.joinPath(dir, `sl_fast_${KEY}_${n.replace(/[^a-z0-9åäö]/g, "_")}.json`);
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
  const results = await Promise.all(cand.map(x => fetchTrains(x[0])));
  const pick = results.findIndex(r => r && r.length > 0);
  if (pick < 0) return { error: `Inga avgångar för ${LABEL} vid "${name}"`, locked: true };
  const x = cand[pick];
  const st = { id: x[0], name: x[1], lat: x[2], lon: x[3] };
  fm.writeString(lp, JSON.stringify(st));
  return { st, deps: results[pick], note: "", locked: true };
}

const res = (await resolveFixed()) || await resolve();
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
const LINE_COLOR = CFG.color; // färg på listen och märket
const LINE_LETTER = CFG.letter;

// Liten widget: bara nästa avgång per håll
function smallRow(parent, title, item) {
  const hs = parent.addStack();
  hs.size = new Size(56, 0); // samma bredd som pillret så att rubriken centreras över det
  hs.addSpacer();
  const h = hs.addText(title);
  h.font = Font.boldSystemFont(9);
  h.textColor = Color.gray();
  hs.addSpacer();
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
  dest.font = Font.boldSystemFont(15);
  dest.textColor = Color.white();
  dest.lineLimit = 1;
  dest.minimumScaleFactor = 0.6;
}

// Teckenbredd (i em, SF Medium) per bokstav, så att textstorleken kan räknas ut för varje namn
const EMW = { a:.55,b:.58,c:.53,d:.58,e:.55,f:.31,g:.58,h:.56,i:.25,j:.25,k:.52,l:.25,m:.87,n:.56,o:.58,p:.58,q:.58,r:.35,s:.5,t:.33,u:.56,v:.5,w:.78,x:.5,y:.5,z:.48,"å":.55,"ä":.55,"ö":.58,"é":.55," ":.26,"-":.35,".":.27,"/":.3,
  A:.67,B:.63,C:.7,D:.7,E:.57,F:.55,G:.72,H:.72,I:.28,J:.5,K:.64,L:.53,M:.87,N:.73,O:.76,P:.6,Q:.76,R:.63,S:.6,T:.58,U:.7,V:.64,W:.95,X:.63,Y:.6,Z:.6,"Å":.67,"Ä":.67,"Ö":.76 };
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

// Tjock färgad header över hela bredden, med ett grått band under för kolumnrubriker
const HEAD_FG = CFG.letterColor ? new Color(CFG.letterColor) : Color.white();
const HEAD_FG_SOFT = new Color(HEAD_FG.hex, 0.8);
const HEAD_FG_RING = new Color(HEAD_FG.hex, 0.75);
const head = w.addStack();
head.backgroundColor = new Color(LINE_COLOR);
head.setPadding(6, SMALL ? 10 : 12, 6, SMALL ? 10 : 12);
head.size = new Size(0, 36); // fast höjd så att iOS inte pressar ihop headern i medium
head.centerAlignContent();

const contentW = Device.screenSize().width - 55 - 24; // uppskattad innehållsbredd
const colW = Math.floor((contentW - 9) / 2);
const ALLD = error ? [] : deps
  .map(d => ({ d, i: info(d, now) }))
  .filter(x => x.i.left >= -1)
  .sort((a, b) => a.i.exp - b.i.exp);
const NL = ALLD.filter(x => isNorth(x.d));
const SL = ALLD.filter(x => !isNorth(x.d));
// Ändstation: tågen går bara åt ett håll. Då delas listan i två kolumner i tidsordning i stället för en tom kolumn.
const TERM = !error && (NL.length === 0) !== (SL.length === 0);
const TERM_LIST = NL.length ? NL : SL;
const TERM_TITLE = NL.length ? CFG.titles[0] : CFG.titles[1];
if (!SMALL && !error) {
  const band = w.addStack();
  band.backgroundColor = new Color("#1c1c1e");
  band.setPadding(3, 12, 3, 12);
  const bt = CFG.titles;
  (TERM ? [TERM_TITLE, ""] : bt).forEach((tt, bi) => {
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
  dc.setTextColor(CFG.letterColor ? new Color(CFG.letterColor) : Color.white());
  dc.setFont(Font.boldSystemFont(letter.length > 1 ? 40 : 54));
  dc.setTextAlignedCenter();
  dc.drawTextInRect(letter, new Rect(0, letter.length > 1 ? 24 : 15, N, N - 15));
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
const modeIc = top.addImage(SFSymbol.named(res.locked ? "lock.fill" : "scope").image);
modeIc.imageSize = new Size(11, 11);
modeIc.tintColor = HEAD_FG_SOFT;
if (!SMALL) top.addSpacer(8);
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
}
content.addSpacer(3);

if (error) {
  const e = content.addText(error);
  e.font = Font.systemFont(13);
  e.textColor = Color.orange();
  if (!config.runsInWidget && (TRIED.length || SEEN.size)) {
    const dbg = content.addText(`Provade: ${TRIED.slice(0, 4).join(", ") || "-"}. Linjer sedda: ${[...SEEN].slice(0, 6).join(", ") || "-"}`);
    dbg.font = Font.systemFont(9);
    dbg.textColor = Color.gray();
  }
} else {
  const all = ALLD;
  const body = content.addStack();
  if (SMALL) {
    body.layoutVertically();
    const nl = all.filter(x => isNorth(x.d));
    const sl = all.filter(x => !isNorth(x.d));
    if (TERM) {
      smallRow(body, TERM_TITLE, TERM_LIST[0]);
      body.addSpacer(5);
      smallRow(body, "DÄREFTER", TERM_LIST[1]);
    } else {
      smallRow(body, CFG.titles[0], nl[0]);
      body.addSpacer(5);
      smallRow(body, CFG.titles[1], sl[0]);
    }
  } else {
    column(body, CFG.titles[0], TERM ? TERM_LIST.slice(0, ROWS) : all.filter(x => isNorth(x.d)), colW);
    body.addSpacer(4);
    const div = body.addStack();
    div.size = new Size(1, 4 + ROWS * 23);
    div.backgroundColor = new Color("#2c2c2e");
    body.addSpacer(4);
    column(body, CFG.titles[1], TERM ? TERM_LIST.slice(ROWS, ROWS * 2) : all.filter(x => !isNorth(x.d)), colW);
  }
}
content.addSpacer();

const sColor = status.kind === "bad" ? new Color(PAL.y.bg)
  : status.kind === "ok" ? new Color(PAL.g.bg)
  : Color.gray();
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
