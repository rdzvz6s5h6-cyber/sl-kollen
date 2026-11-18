// SL-kollen – Roslagsbanan
// Kopiera hela filen till ett nytt skript i Scriptable. Inget behöver ändras.
const LINJE = "roslagsbanan";

const URL = "https://raw.githubusercontent.com/rdzvz6s5h6-cyber/SL-kollen/main/SL-linje.js";

const fm = FileManager.local();
const cache = fm.joinPath(fm.documentsDirectory(), `sl_linje_cache_${LINJE}.js`);

let code = null;
try {
  const req = new Request(URL);
  req.timeoutInterval = 10;
  const text = await req.loadString();
  if (req.response.statusCode !== 200 || !text || text.length < 500) {
    throw new Error("Ogiltigt svar");
  }
  code = text;
  fm.writeString(cache, code);
} catch (e) {
  if (fm.fileExists(cache)) code = fm.readString(cache);
}

if (!code) {
  const w = new ListWidget();
  w.backgroundColor = Color.black();
  const t = w.addText("Kunde inte hämta widgeten. Kör skriptet i appen med nät.");
  t.textColor = Color.white();
  t.font = Font.systemFont(12);
  if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
  Script.complete();
} else {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction("SL_LINJE", code)(LINJE);
}
