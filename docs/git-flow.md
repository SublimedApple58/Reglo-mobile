# Git flow & ambienti — Reglo Mobile

Come si lavora con branch e ambienti **dev → staging → prod** lato mobile. La fonte completa (web/backend, dettagli staging) è in `reglo/docs/architecture/git-flow.md` + `reglo/docs/STAGING.md`.

## Branch & ambienti

| Branch | Ambiente | Note |
|--------|----------|------|
| _feature branch_ (es. `feature/vehicles-redesign`) | dev | dove si sviluppa; **lo stesso nome su entrambi i repo** (`reglo` + `reglo-mobile`) per i lavori grossi |
| **`staging`** | pre-rilascio CONDIVISO | l'app ci punta con `npm run ios:staging` / `android:staging` (API = `staging.reglo.it`) |
| **`master`** | **produzione** | da qui partono le build/OTA prod |

- **Lavori grossi → feature branch dedicato su ENTRAMBI i repo**, mai diretto su `master` finché non finito/approvato.
- **`staging` è condiviso**: prima di shippare lato backend, si allinea `origin/staging` nel branch (vedi doc reglo). Il mobile non ha un branch `staging` proprio da deployare: testa contro il **backend** di staging.

## Testare contro staging
```bash
npm run ios:staging       # simulatore iOS → API staging.reglo.it (+ header bypass)
npm run android:staging   # emulatore Android → idem
```
Richiede il file `reglo-mobile/.staging-bypass` (gitignored) col Protection Bypass secret di Vercel:
```bash
printf '%s' '<protection-bypass-secret>' > reglo-mobile/.staging-bypass
```
Le modifiche solo-JS si vedono in **hot-reload** (Metro), niente rebuild nativo; serve un rebuild solo se cambiano moduli/asset nativi.

## Rilascio in produzione (con OK esplicito dell'utente)
1. Merge `feature` → **`master`**.
2. **OTA** (per modifiche solo-JS): `eas update --platform ios --branch production --message "..."` **poi** `eas update --platform android --branch production --message "..."`.
   - **MAI `--auto`** (punta a `master` invece che a `production`). **MAI `--platform all`** (sempre ios e android separati).
3. **Native build** (solo se cambia lo strato nativo): segui la checklist [Rilascio build nativa (store) + OTA dopo](#rilascio-build-nativa-store--ota-dopo).

## Rilascio build nativa (store) + OTA dopo

> **Stato attuale** (aggiorna questa riga a ogni rilascio nativo, 29/10/2026): sugli **store** c'è la **2.3.0** (`runtimeVersion` 2.3.0, App Store + Play Store dal 2026-09-16); la **2.4.0** (`runtimeVersion` 2.4.0, moduli nativi di Road) è **solo la build TestFlight** con cui si prova Road, e `master` ha già `app.json` → `runtimeVersion: "2.4.0"`. Store e TestFlight leggono lo **stesso canale EAS `production`**: a separarli è solo il runtime. Quindi ogni OTA da `master` arriva **solo ai 2.4.0** (TestFlight), mai agli utenti 2.3.0 degli store. Prima di ogni `eas update`: `app.json` runtimeVersion = 2.4.0, `--branch production`, e nell'output di eas update il runtime deve dire 2.4.0. Force-update floor **2.3.0** iOS+Android (non alzarlo finché la 2.4.0 non è sugli store).

Ogni passo outward-facing (build prod, submit, OTA, floor) solo con **OK esplicito dell'utente**.

### 1. Serve davvero una build nativa?
Serve se cambia lo **strato nativo**: nuovo pacchetto con codice nativo (o rimosso), upgrade Expo SDK / React Native, config nativa (`app.json` plugin, permessi, `ios`/`android`, icone/splash).
Check prima di ogni OTA e prima di decidere:
```bash
git diff <commit del binario live> HEAD -- package.json app.json
```
Se compaiono moduli nativi nuovi → **niente OTA**, serve la build. Un OTA con un modulo nativo assente dal binario **crasha l'app al lancio** (successo il 2026-06-10).

### 2. `runtimeVersion`
- È una **stringa fissa manuale** in `app.json` (non `policy: appVersion`, non `fingerprint`): definisce il cohort OTA.
- Si bumpa **SOLO** su cambio nativo **o** su un cutover force-update voluto (cohort nuovo). Per OTA JS/asset resta invariato.
- Si bumpa **sempre insieme a `version`** marketing (es. 2.3.0 → 2.4.0 entrambi) e si aggiorna la nota `"//"` in `app.json`.
- iOS e Android si buildano **insieme** (stesso runtime):
  ```bash
  eas build --profile production --platform ios
  eas build --profile production --platform android
  ```
  Build number: `autoIncrement` + `appVersionSource: "remote"` in `eas.json` → non toccarlo a mano.

### 3. Submit agli store
Upload manuale (Transporter per iOS, Play Console per Android), poi review e rilascio. Da quando il runtime è bumpato, gli OTA vanno **solo** al nuovo cohort: i binari vecchi restano fermi al loro ultimo OTA.

### 4. Dopo che è live su ENTRAMBI gli store: alza il force-update floor
- In `reglo/` → `app/api/mobile/app-config/route.ts` → `MIN_SUPPORTED_VERSION = { ios, android }` = nuova versione.
- Passa dal flusso web normale: feature branch → `staging` → `main` (push su `main` = deploy Vercel).
- Verifica (~2-3 min di propagazione): `curl https://app.reglo.it/api/mobile/app-config`.
- Il gate (`useForceUpdate` in `app/_layout.tsx`, `src/config/forceUpdate.ts`) è nei binari da 2.0.0: nessuna modifica mobile. Scatta al cold-start, fail-open. Rollback = rimetti il valore precedente.

### 5. OTA successivi
```bash
eas update --branch production --platform ios --message "..."
eas update --branch production --platform android --message "..."
```
Raggiungono solo i binari col runtime corrente. **MAI `--auto`** (punta a `master`), **MAI `--platform all`**. Niente staging mobile: si verifica in locale e si rilascia in prod.

### 6. Recovery (OTA rotto in prod)
```bash
eas update:roll-back-to-embedded --branch production --platform ios --runtime-version <runtime> --message "..."
# poi lo stesso con --platform android
```
In non-interattivo `--runtime-version` è obbligatorio.

### 7. Chiudi il giro
Aggiorna la riga **Stato attuale** in cima a questa sezione (runtime + floor + data).

## Regole d'oro
1. `staging` è condiviso → lato backend si allinea PRIMA di shippare (doc reglo).
2. Niente lavoro diretto su `master` per task grossi → feature branch su entrambi i repo.
3. Niente OTA/build prod senza OK esplicito dell'utente.
4. Prima del merge in `master` le verifiche sono `npx tsc --noEmit -p .` + `npx expo export --platform ios` (il bundle compila): il repo **non ha script di lint né di test**, non cercarli. L'unico errore tsc noto e tollerato è `src/navigation/TabNavigator.tsx(27)`.
5. Un branch costruito sopra un altro branch **non ancora in `master`** se lo porta dietro: il merge in `master` pubblica anche quello (es. REG-639 nato su REG-638 ha portato tutto Road in `master` il 28/10). Prima del merge controlla `git log origin/master..HEAD` e dillo all'utente.
