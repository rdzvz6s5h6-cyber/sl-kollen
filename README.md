# SL-kollen

Widgets för iPhone som visar nästa avgångar från din närmaste SL-station: minuter kvar, färg för försening och trafikläget. Bara text.

![Liten](bilder/pendeltag-liten.jpg)
![Mellan](bilder/pendeltag-mellan.jpg)
![Stor](bilder/pendeltag-stor.jpg)

Storlekar: liten, mellan och stor.

## Linjer
Pendeltåg, tunnelbanans röda, gröna och blå linje, Roslagsbanan, Tvärbanan, Lidingöbanan, Nockebybanan, Saltsjöbanan och Spårväg City, bussar och båtar.

När SL-kollen byggdes hade gula linjen (Fridhemsplan–Älvsjö) inte öppnat än. Skriptet är förberett i förväg och har inte kunnat provas, så det kan behöva justeras efter öppningen.

## Kom igång
1. Installera appen **Scriptable** från App Store.
2. Öppna mappen `kopiera/` här på GitHub, välj din linje och tryck på **Copy raw file**.
3. Skapa ett nytt skript i Scriptable, klistra in och kör det en gång i appen. Tillåt platsåtkomst (helst "Alltid").
4. Lägg till en Scriptable-widget på hemskärmen, håll in den, välj **Redigera widget** och välj skriptet.

Vill du ha flera linjer gör du ett skript per linje. Lägg widgetarna i en iOS-stack så kan du swipa mellan dem.

## Så läser du widgeten
- Pillerna visar minuter kvar. Grön är i tid, gul är försenad och röd är mycket försenad eller inställd.
- Längst ner står trafikläget. Grön text betyder inga störningar, gul är en störning.
- Stationen väljs automatiskt utifrån din plats.
- Buss och båt visar en lista med alla linjer från närmaste hållplats eller brygga i tidsordning, med linjenumret bredvid.

## Uppdateringar
Skripten hämtar sin kod härifrån varje gång de körs, så du får ändringar automatiskt (GitHub fördröjer ca 5 minuter). Det betyder också att du kör kod från den här repon, så dela den bara med folk du litar på.

Data kommer från SL:s öppna API:er (Transport och Deviations).
