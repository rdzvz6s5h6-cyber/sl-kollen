# SL-pendeln

Scriptable-widget för iPhone som visar SL pendeltåg från närmaste station: nästa tre tåg norrut och söderut, minuter kvar, färg för försening och trafikläget längst ner. Bara text, ingen karta.

## Filer
- `SL-pendeltag.js` – själva widgeten. **Det här är filen du redigerar.**
- `Laddare.js` – liten laddare som alla användare klistrar in i Scriptable en gång. Den hämtar `SL-pendeltag.js` härifrån varje gång widgeten körs och sparar en kopia för när nätet saknas. Ändras aldrig.

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

## Planerat
- Egen widget för tunnelbana och en för buss.
