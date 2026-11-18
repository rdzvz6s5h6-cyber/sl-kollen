# SL-kollen

Widgets för iPhone som visar nästa avgångar från din närmaste SL-station: minuter kvar, färg för försening och trafikläget. Bara text.

![Liten](bilder/pendeltag-liten.jpg)
![Mellan](bilder/pendeltag-mellan.jpg)
![Stor](bilder/pendeltag-stor.jpg)

Storlekar: liten, mellan och stor.

## Linjer
Pendeltåg, tunnelbanans röda, gröna och blå linje, Roslagsbanan, Tvärbanan, Lidingöbanan, Nockebybanan, Saltsjöbanan, Spårväg City och bussar. Dessutom en widget för båtar.

**Status:** alla utom två är provade mot riktig data. Gula linjen (Fridhemsplan–Älvsjö) hade inte öppnat när SL-kollen byggdes, så skriptet är förberett i förväg och kan behöva justeras efter öppningen. Båtwidgeten är inte provad än.

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
- Buss och båt visar en lista med alla linjer från närmaste hållplats eller brygga i tidsordning, med linjenumret bredvid. Blåbussar har blå bricka och övriga bussar röd. På bussar står också hållplatsläget (Läge A, B …).
- Stor buss-widget visar upp till 10 avgångar. Finns det störningar visas de i sin helhet och tar då plats från de sista avgångarna.

## Uppdateringar
Skripten hämtar sin kod härifrån varje gång de körs, så du får ändringar automatiskt (GitHub fördröjer ca 5 minuter). Det betyder också att du kör kod från den här repon, så dela den bara med folk du litar på.

Data kommer från SL:s öppna API:er (Transport och Deviations).
