# Modalità manutenzione (REG-773) — mobile

Il titolare può mettere l'autoscuola in manutenzione: l'app smette di
funzionare per chi è bloccato e mostra solo una schermata dedicata. Lo sblocco
lo fa **solo il backoffice** Reglo. Regole complete, backend e decisioni
(soldi che non si fermano, sblocco senza interventi):
`reglo/docs/features/maintenance-mode.md`.

## Chi è bloccato

`CompanySummary.maintenance { scope, since, blocked }` arriva da login e
`GET /api/mobile/me`. `blocked` lo calcola il backend per il ruolo del membro:
titolari sempre, istruttori e allievi solo con `scope = EVERYONE`.

## Come funziona

- **Sessione** (`SessionContext`): `maintenance` = la manutenzione
  dell'autoscuola attiva, solo se `blocked`. Si aggiorna:
  - a ogni `refreshMe` (login, avvio, cambio autoscuola);
  - quando una richiesta torna con `message: "COMPANY_MAINTENANCE"`
    (`onCompanyMaintenance` in `apiClient`) → `refreshMe`;
  - al ritorno in primo piano mentre si è bloccati → `refreshMe`: allo sblocco
    l'app riparte da sola, senza rifare il login.
- **Gate** (`app/_layout.tsx` → `AuthGate`): con `maintenance` la `<Slot/>`
  si smonta e resta solo `MaintenanceScreen` (niente richieste respinte in
  sottofondo). In manutenzione non si registra il token push; si rifà allo
  sblocco.
- **`MaintenanceScreen`**: barriera 3D, «{autoscuola} è in manutenzione»,
  «L'account è temporaneamente in manutenzione e l'app tornerà disponibile il
  prima possibile.», unica azione **Esci**. Testo **uguale per tutti i ruoli**:
  non deve mai far capire che l'ha chiesto il titolare né l'ambito.
- **Attivazione** (solo titolare): Impostazioni → Account → «Modalità
  manutenzione» → form sheet `more/maintenance` (FORM_SHEET + `FormSheet`):
  ambito «Solo te / Tutti» con la spunta, nome dell'autoscuola da scrivere
  (la CTA si attiva solo se coincide), `POST /api/autoscuole/maintenance`.
  Dopo: chiude il foglio e `refreshMe` → schermata di manutenzione.

## File

| File | Ruolo |
|---|---|
| `src/screens/MaintenanceScreen.tsx` | Schermata |
| `app/_layout.tsx` (`AuthGate`) | Gate |
| `src/context/SessionContext.tsx` | Stato `maintenance`, ascolto di `COMPANY_MAINTENANCE`, ricontrollo in primo piano |
| `src/services/apiClient.ts` | `COMPANY_MAINTENANCE`, `onCompanyMaintenance` |
| `src/services/regloApi.ts` | `activateMaintenance` |
| `src/types/regloApi.ts` | `CompanyMaintenance`, `MaintenanceScope` |
| `app/(tabs)/more/maintenance.tsx` | Foglio di conferma |
| `src/screens/SettingsScreen.tsx` | Riga (solo titolare) |
| `assets/icons3d-ai/barriera*.png`, `barriera-grande*.png` | Icona 3D (riga 32 pt, schermata 150 pt) |
