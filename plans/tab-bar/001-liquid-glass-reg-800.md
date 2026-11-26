# REG-800 — Tab bar Liquid Glass nativa + set icone Reglo

## Cosa è stato fatto (26/11/2026, commit locali, niente OTA)
- iOS: `NativeTabs` di expo-router (UITabBar di sistema, Liquid Glass su iOS 26), icone PNG nostre a colori originali (patch expo-router `imageSource`), tratto grigio a riposo, multicolore accese.
- Android: `AppTabBar` con gli stessi SVG.
- Allievo con una voce sola: niente barra.
- Spazio in fondo su iOS, «Torna in Road» sopra la barra, barra del fantasma dell'Agenda sopra la barra, campanella titolare su Oggi.
- Verificato sul simulatore iPhone 17 Pro / iOS 26.2 (titolare reale su staging, istruttore e allievo con forzature locali non committate).
- Doc: design-system §6.19, `docs/features/tab-bar.md`, INDEX, impact-map, routing.

## Percorso
1. Analisi (OTA basta: react-native-screens 4.16 nei binari, ipa con SDK iOS 26.2) e anteprime v1 (colore unico).
2. v2: alternative Scambi/Tu, palette per voce → scelti S3 Biglietto e T2 Patente.
3. v3: icone accese multicolore realistiche (approvato).
4. Implementazione + verifica simulatore.

## Emendamenti emersi in implementazione
- Etichette spente nere su iOS 26 (sistema ignora il grigio).
- Rimpicciolimento allo scroll non funziona con screens 4.16.
- Barra nativa che resta montata fino al riavvio se si scende a una voce sola (errore di react-native-screens smontandola a caldo).

## Prima del rilascio
- OTA doppio (runtime 2.4.0 e 2.4.2), iOS poi Android.
- Prova su build Release (le asserzioni di react-native-screens sono solo in debug) dei cambi di voci a caldo (Road acceso/spento, Scambi che si carica).
- Prova Android (barra JS con SVG) su emulatore.
