# Associazione all'istruttore via QR (REG-451)

## Cosa fa
L'allievo si associa al suo istruttore di riferimento dal QR della card stampata dall'autoscuola (o col codice di 6 caratteri). Schermate 1:1 dal prototipo `QR Istruttore.html` (font di sistema come il resto dell'app): **Conferma**, **Successo**, **Già associato** (Cambia / Mantieni), **Mantieni**, **Errore**, **Codice a mano**.

## Come si arriva
- **Profilo → "Scansiona QR"** (riga nel primo gruppo di `SettingsScreen`, solo allievi; è l'istruzione stampata sulla card).
- **Fotocamera del telefono**: il QR apre la pagina web `app.reglo.it/i/<codice>` → "Apri nell'app" → deep link `com.tiziano.developer.reglo-mobile://associa-istruttore?code=<codice>`.

## Scanner live
`src/components/InstructorQrScanner.tsx` (expo-camera `CameraView`, solo QR): schermata "Scanner" del prototipo sopra l'anteprima fotocamera, con permesso negato → link alle impostazioni. **Solo nei binari ≥ 2.3.0** (runtime 2.3.0, expo-camera nativo): `InstructorLinkScreen` lo carica con `require` pigro solo se `requireOptionalNativeModule('ExpoCamera')` esiste. Sui binari 2.2.0 (senza modulo) resta il comportamento dell'OTA di REG-451: si parte dal codice a mano e mancano i bottoni verso lo scanner.

Con lo scanner: "Scansiona QR" → Scanner; Annulla/"Non è il mio istruttore" e "Indietro" dal codice a mano → Scanner; Errore → "Scansiona di nuovo" + "Inserisci il codice a mano" (come il prototipo).

## File
- `src/screens/InstructorLinkScreen.tsx` — tutte le schermate (macchina a stati locale)
- `src/components/InstructorQrScanner.tsx` — scanner (expo-camera)
- `app/(tabs)/settings/associa-istruttore.tsx` — route, `fullScreenModal` (in `settings/_layout.tsx`)
- `app/+native-intent.tsx` — riscrive `associa-istruttore?code=` → home + codice pendente
- `src/utils/pendingInstructorLink.ts` — codice pendente + listener
- `app/_layout.tsx` (AuthGate) — consuma il codice quando la sessione è pronta (anche dopo il login) e apre la route
- `src/services/regloApi.ts` — `getInstructorLinkPreview(code)`, `linkInstructor(code)`; tipi `InstructorLinkPreview`, `InstructorLinkResult` in `src/types/regloApi.ts`

## Backend
`GET/POST /api/autoscuole/me/instructor-link` (vedi `reglo/docs/features/instructor-qr-link.md`). 403 per chi non è allievo → schermata "Solo per gli allievi". Dopo l'associazione si invalidano tutte le query (le impostazioni effettive dipendono dall'istruttore assegnato).

## Note
Il deep link usa lo scheme già registrato nei binari (nessuna build necessaria). Deep link verificato con Maestro su simulatore (istruttore → 403 → errore); schermate Conferma/Successo non provate a schermo perché l'app di sviluppo punta al backend di prod (niente scritture di test lì).
