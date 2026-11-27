# Onboarding dell'allievo + disponibilità a fasce (REG-802)

Sostituisce il vecchio **Phone Gate** (`PhoneGateScreen`, tolto). Backend e regole di prodotto: `../reglo/docs/features/student-availability-onboarding.md`. Piano e decisioni di Tiziano: `/tmp/hiro-anteprime/reg-802/piano.md` (§10).

## Cosa fa
Un allievo con qualcosa da completare, a sessione aperta, non entra nelle tab: l'`AuthGate` lo porta nello stack `app/onboarding` finché `/api/mobile/me` ha degli `onboarding.steps`. Gli step li decide il server:

| Caso | Step |
|---|---|
| Account creato dall'autoscuola con email e password, **mai entrato** (`User.profileCompletedAt` null) — «primo accesso normale» | nome → email → cellulare → disponibilità → «Tutto giusto?» → «Eccoti» |
| Profilo completo ma **senza cellulare** (era il Phone Gate) | cellulare |
| **Disponibilità mancanti**: bloccante in fase guide, rimandabile prima (AWAITING/TEORIA), assente per chi ha finito | disponibilità |

Con un backend senza il campo (`onboarding` assente) vale la regola del vecchio Phone Gate (solo il cellulare), così l'app resta corretta in ogni ordine di rilascio. Gli step che una versione dell'app non conosce si saltano (`ONBOARDING_SCREENS`).

## Flusso
- `SessionContext`: `onboarding` nello stato (`resolveOnboarding` in `src/utils/onboarding.ts`). Dopo il login (`applyAuthPayload`) un allievo legge subito `/me`, così va dritto agli step senza passare dalla home; se `/me` fallisce vale la regola del Phone Gate. Un allievo che torna nell'app dopo 30 min rilegge `/me` (il rinvio di «Configura in seguito» scade lato server dopo 3 giorni). `setOnboarding` per chiudere senza rileggere.
- `app/_layout.tsx` `AuthGate`: con step → `router.replace('/onboarding')`; senza step e dentro `onboarding` → home. Le intenzioni da notifica aspettano la fine dell'onboarding. Ordine: manutenzione → onboarding → percorso patente (REG-410, nelle tab) → tab.
- `app/onboarding/_layout.tsx`: `OnboardingProvider` + Stack (fondo bianco). `index` = primo step dovuto (`OnboardingStepFor`), gli altri con push (`name`, `email`, `phone`, `availability`, `confirm`); fogli `country-picker` e `student-day` (`FORM_SHEET`).
- `OnboardingContext`: step fissati all'apertura, bozza (nome/cognome dal nome dell'account con iniziali maiuscole, cellulare, disponibilità e fasce lette dal server all'apertura), avanzamento, `next()` (push o salvataggio se era l'ultimo), `submit()` → `POST /api/autoscuole/me/onboarding` in un colpo solo, poi `refreshMe()` (nome e cellulare nuovi in sessione). Col riepilogo: «Eccoti, Sara» per 1,4 s, poi home.
- Scheletro: `FirstAccessStepScreen` generalizzato (`progress` esplicito o assente, `leading: 'none'` sul primo passo bloccante, `onClose` = X dei passi rimandabili, `below` sotto la CTA). CTA che sale con la tastiera, fuoco a schermata ferma (`useFocusAfterPush`).

## Schermate
- **Cellulare** (`OnboardingPhoneStep`): «Il tuo numero di cellulare», `PhoneField` col foglio «Prefisso» dello stack onboarding (`pickerHref`), «Esci». Con +39 servono 9 cifre (anche lato server) e il numero si legge a gruppi («347 123 4567», `formatNational`). Sopra il titolo il telefono 3D `VITA_ART.telefono` (Gemini, 27/11).
- **Nome** («Ciao Sara») ed **email** («La tua email», riga in sola lettura col lucchetto; «Scrivici su WhatsApp» apre `wa.me/393477756855` col messaggio già scritto, `mailto:support@reglo.it` se WhatsApp non c'è) — `OnboardingProfileSteps.tsx`.
- **Disponibilità** (`OnboardingAvailabilityStep`): orologio 3D (`VITA_ART.orologio`), «Quando puoi fare guida?», editor. Bloccante: «Esci» se è l'unico passo. Rimandabile: «Configura in seguito» (e la X se è l'unico passo) → `POST me/availability/snooze`.
- **Riepilogo** «Tutto giusto?» (righe che riportano allo step) e «Eccoti».

## Disponibilità a fasce (componenti condivisi)
- `src/components/studentAvailability/StudentWeekStrip.tsx` — la settimana a colonne lun→dom su scala fissa 8–21, linee alle 13 e alle 18, fasce attaccate in una barra con un taglio bianco. Premibile (editor) o in sola lettura (staff).
- `StudentAvailabilityEditor.tsx` — settimana + «Va bene qualsiasi orario» (spento torna alle scelte di prima) + sette righe; il tocco apre `StudentDaySheet` (tre fasce con spunta, «Uguale per tutti i giorni», «Fatto») tramite `studentDayStore`. Il foglio va registrato come `student-day` in ogni stack che lo apre: `onboarding`, `(tabs)/settings`, `(auth)/first-access`.
- `src/utils/studentAvailability.ts` — testi e conti puri (`bandsText`, `hoursText`, `summaryText`, `daysListText`, `mergedRanges`, `DEFAULT_BANDS`…). Le fasce vere arrivano dal server.
- **Profilo › Disponibilità** (`StudentAvailabilityScreen`, `(tabs)/settings/availability`): pagina piena col titolo grande che collassa (era un foglio alto con cerchietti dei giorni e salvataggio che chiudeva prima della risposta). «Salva» solo con modifiche, spinner, toast. Dati da `useMyStudentAvailability` (query `studentAvailability`), letta dal Profilo: la riga mostra il riassunto e la pagina si apre già piena.
- **Primo accesso col telefono**: nuovo passo `availability` fra data di nascita e riepilogo (rimandabile: prima del login la fase non si sa), riga nel riepilogo; vedi `first-access.md`.
- **Staff** (istruttore, titolare): riga «Disponibilità» nella lista «Allievo» del dettaglio allievo e foglio `student-availability` in sola lettura (`StudentAvailabilityStaffSheet`, store `studentAvailabilitySheetStore`), registrato negli stack `home`, `notes`, `road`. Dati caricati con il dettaglio (`GET /api/autoscuole/students/:id/availability`); vedi `dettaglio-allievo.md`.

## API (`src/services/regloApi.ts`)
`me` (con `onboarding`), `completeOnboarding`, `getMyAvailability`, `saveMyAvailability`, `snoozeMyAvailability`, `getStudentAvailability(studentId)`; `firstAccessComplete` accetta `availability`. Tipi in `src/types/regloApi.ts`: `StudentOnboarding`, `OnboardingStep`, `StudentAvailabilityPayload`, `StudentBandsByDay`, `CompleteOnboardingInput`.

## Prove (27/11, simulatore + backend dev del worktree)
Allievi di prova da `../reglo/scripts/seed-reg802.ts` (Sara: mai entrata, in pratica; Luca: in teoria; Marta: da attivare col telefono). Catture in `/tmp/hiro-anteprime/reg-802/sim/`: primo accesso normale completo fino alla home (DB verificato), cellulare con la tastiera, foglio del giorno, Profilo › Disponibilità con salvataggio, step rimandabile di Luca con rinvio, Primo accesso di Marta fino al riepilogo, dettaglio allievo e foglio staff.

## Note
- OTA-safe: nessun modulo nativo nuovo.
- Rilascio: il backend REG-802 deve essere in produzione PRIMA dell'OTA (i lettori del motore sulle fasce per giorno, le rotte `me/*`). Con un backend vecchio l'app funziona (regola Phone Gate), ma le rotte delle disponibilità rispondono 404.

## Giro 2 (27/11, richieste di Tiziano)

- **Più calore**: icone 3D Gemini sopra il titolo di «Ciao Sara» (`VITA_ART.tessera`), «La tua email» (`VITA_ART.busta`, tolta la busta monocromatica dalla riga) e «Tutto giusto?» (`VITA_ART.cartellina`); tutti gli eroi dell'onboarding a 64 pt.
- **Disponibilità guidata** (solo onboarding, il Profilo tiene `StudentAvailabilityEditor`): `src/components/studentAvailability/StudentAvailabilityGuided.tsx`. Una domanda alla volta: «Di solito sei libero…» (mattina/pomeriggio/sera o «Va bene qualsiasi orario») → «In quali giorni?» (compare con una dissolvenza e la schermata ci scorre da sola, `revealKey`; la settimana è il comando: i giorni vuoti mostrano le fasce in trasparenza, `StudentWeekStrip` `ghost`, un tocco le riempie o le toglie) → «Un giorno è diverso?» (righe dei giorni scelti → foglio del giorno). Cambiare le fasce «di solito» aggiorna i giorni che le seguivano; quelli cambiati a mano restano.
- **Riepilogo grafico**: in «Tutto giusto?» la disponibilità è la settimana disegnata (`StudentWeekStrip` in sola lettura, tutta toccabile → torna allo step), non più una riga di testo.
- Il Primo accesso col telefono (approvato così) tiene editor e riepilogo di prima.
