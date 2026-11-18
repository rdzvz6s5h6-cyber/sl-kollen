# SL-pendeln

Scriptable-widget för iPhone som visar SL pendeltåg från närmaste station: nästa tre tåg norrut och söderut, minuter kvar, färg för försening och trafikläget längst ner. Bara text, ingen karta.

## Filer
- `SL-pendeltag.js` – pendeltågs-widgeten. **Det här är filen du redigerar.**
- `Laddare.js` – liten laddare som alla användare klistrar in i Scriptable en gång. Den hämtar `SL-pendeltag.js` härifrån varje gång widgeten körs och sparar en kopia för när nätet saknas. Ändras aldrig.
- `SL-tunnelbana-roda.js` – tunnelbanans röda linje (13, 14), samma layout. Första version, ej testad på telefon.
- `Laddare-tunnelbana.js` – laddare för tunnelbane-widgeten (egen cache, påverkar inte pendeln).

Lägg båda widgetarna ovanpå varandra på hemskärmen (iOS-stack) för att swipa mellan dem.

## Installera (för dig eller en kompis)
1. Installera appen Scriptable.
2. Nytt skript, klistra in innehållet i `Laddare.js`.
3. Kör skriptet **i appen** en gång (laddar ner stationslistan). Tillåt platsåtkomst, helst "Alltid".
4. Lägg till en Scriptable-widget (medium) på hemskärmen och välj skriptet.

## Uppdatera
Redigera `SL-pendeltag.js` här på GitHub. Alla får ändringen automatiskt, men GitHub cachar filen i ca 5 minuter.

## Regler för ändringar
- En ändring i taget. Testa, utvärdera, gå vidare.
- Testa i en egen fil (t.ex. `SL-pendeltag-test.js` med en egen laddare) innan du ändrar huvudfilen. Ett fel i huvudfilen slår ut alla användare.
- Den som använder laddaren kör kod från den här repon. Dela den bara med folk du litar på.

## Färger (försening)
- Grön: 0–5 min
- Gul: 6–10 min
- Röd: över 10 min eller inställt (samma gränser som Trafikverkets tågkarta)

## Data
SL Transport API och SL Deviations API (öppna, ingen nyckel):
- `https://transport.integration.sl.se/v1`
- `https://deviations.integration.sl.se/v1`

## Känt / ej verifierat
- Riktning (NORR/SÖDER) via `direction_code` är bara kontrollerad vid Älvsjö.
- Stationsval via plats är inte bekräftat i alla lägen ("senaste plats" visas när plats saknas).
- Inställda tåg upptäcks med en gissning på fältet `state`.
- Grön text "Inga störningar" är inte sedd i praktiken än.

## Tunnelbana (röda linjen) – ej verifierat
- Station väljs bland röda linjens stationsnamn (lista i koden), annars de 20 närmaste platserna med röd avgång.
- NORR = mot Ropsten/Mörby centrum, SÖDER = mot Norsborg/Fruängen (efter destinationsnamn).
- Färggränser för försening är satta till gul 3–5 min, röd 6+ min (gissning, justera `LITE`/`MYCKET`).
- Röda linjen filtreras på `line.group_of_lines` / `line.designation` (13, 14). Fältnamnen är inte provade mot riktig data.
- Trafikläget filtreras på röda linjen via `scope.lines`; saknas den räknas störningen som relevant.

## Planerat
- Gröna och blå linjen (Farsta centrum ligger på gröna).
- Egen widget för buss.
