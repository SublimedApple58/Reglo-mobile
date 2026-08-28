# License Path Gate — scelta percorso patente al primo accesso (REG-410)

Gate **bloccante** per l'allievo che si è registrato **in autonomia** (self sign-up) e non ha ancora scelto il proprio percorso patente: finché non sceglie **categoria + cambio** non può usare NULLA dell'app. Stesso pattern del [Phone Gate](phone-gate.md): sostituisce l'intero albero Tabs, niente back/close, uniche uscite = confermare o uscire (logout).

Il flag arriva dal backend: `GET /api/autoscuole/me` → `needsLicensePath` (`selfRegistered && !licenseCategory`). Gli allievi aggiunti manualmente dallo staff hanno `selfRegistered=false` → mai gated. Vedi `reglo/docs/features/license-path-selfselect.md`.

## Files

| File | Ruolo |
|------|-------|
| `src/screens/LicensePathGateScreen.tsx` | La schermata (Airbnb 3D style: icona gradient navy, card patente selezionabili, sezione "Tipo di cambio" obbligatoria, CTA gradient, link "Esci") |
| `app/(tabs)/_layout.tsx` | Mount point: early-return `<LicensePathGateScreen />` — dopo il phone gate — quando `status === 'ready' && isStudent && needsLicensePath` |
| `src/hooks/useStudentPhase.ts` | Espone `needsLicensePath` (da `StudentPhasePayload`) |
| `src/services/regloApi.ts` | `setLicensePath({ licenseCategory, transmission })` → `PATCH /api/autoscuole/me/license-path` |
| `src/types/regloApi.ts` | `StudentPhasePayload.needsLicensePath?: boolean` |
| `src/utils/license.ts` | `STUDENT_LICENSE_CATEGORIES` (`B/AM/A1/A2/A`) + `LICENSE_CATEGORY_LABELS`, `TRANSMISSION_LABELS`, `isMotoLicenseCategory` |

## Comportamento

- **Blocco totale**: il gate sostituisce `<Tabs>` — nessuna route raggiungibile, niente back/close. Uniche uscite: confermare o "Esci" (logout con Alert di conferma). Solo allievi (`isStudent`); istruttori/titolari mai bloccati.
- **Scelta patente**: 5 card selezionabili — `B` (Auto), `AM` (Ciclomotore), `A1` (Moto 125), `A2` (Moto media potenza), `A` (Moto senza limiti). Icona `car`/`motorbike` (MaterialCommunityIcons); selezionata = ring navy + chip pieno + check.
- **Tipo di cambio — OBBLIGATORIO** (REG-410, decisione Tiziano 2026-08-28): due card di peso pari alle categorie (Manuale = `car-shift-pattern` / Automatico = `alpha-a-circle`), valide per **tutte** le categorie (auto e moto). **Nessun default**: parte non selezionato, con pill "OBBLIGATORIO" + hint "Scegli il tipo di cambio per continuare". La CTA "Conferma e continua" è **disabilitata finché non sono scelti sia categoria sia cambio** (`canConfirm = category && transmission`).
- **Salvataggio**: `regloApi.setLicensePath(...)` → `invalidateQueries(queryKeys.studentPhase(activeCompanyId))` → `refreshMe()`. Al refetch `needsLicensePath` diventa `false` e il gate scompare da solo al re-render del layout (nessuna navigazione esplicita). Errore → messaggio inline, resta sul gate.
- **Layout**: opzioni in `ScrollView`, CTA + "Esci" pinnati in basso (come il phone gate) → la CTA non viene mai tagliata anche con tastiera/contenuto lungo.

## Connessioni

- **SessionContext**: legge `activeCompanyId`, usa `refreshMe` + `signOut`.
- **Student Phase**: `needsLicensePath` viaggia su `StudentPhasePayload` (`useMyPhase`/`useStudentPhase`). Il gate è **ortogonale** alla fase: precede qualunque home per-fase (AWAITING/TEORIA/PRATICA). Vedi [student-phase.md](student-phase.md).
- **Phone Gate**: stesso pattern e ordine di montaggio (prima phone, poi license). Vedi [phone-gate.md](phone-gate.md).
- **Backend**: `reglo/app/api/autoscuole/me/route.ts` (`needsLicensePath`), `reglo/app/api/autoscuole/me/license-path/route.ts` (PATCH self-scoped), `reglo/app/api/mobile/auth/student-register/route.ts` (marca `selfRegistered`, niente seed licenza).
- **Design**: preview approvata in iterazione (HTML + screenshot reali da simulatore, Airbnb-style 3D mono-navy).
