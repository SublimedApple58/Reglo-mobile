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
3. **Native build** (solo se cambiano moduli nativi): `eas build --profile production --platform ios|android`, e ricordarsi del `runtimeVersion` (vedi memorie / `app.json`).

## Regole d'oro
1. `staging` è condiviso → lato backend si allinea PRIMA di shippare (doc reglo).
2. Niente lavoro diretto su `master` per task grossi → feature branch su entrambi i repo.
3. Niente OTA/build prod senza OK esplicito dell'utente.
