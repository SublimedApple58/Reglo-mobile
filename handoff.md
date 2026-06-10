# Handoff — Redesign mobile Reglo

_Per il prossimo agente, anche senza memoria della sessione. Questo file NON è un changelog: contiene solo dove si lavora, come si lavora, e le info operative che servono per andare avanti. Le cose già fatte stanno in git + nelle memorie._

## Cosa stiamo facendo

Rifacimento UI dell'app mobile (`/Users/tizianodifelice/reglo-mobile` — Expo 54, RN 0.81.5, Expo Router 6). Direzione: **mono-navy, premium, minimale**. Tutto sul branch **`feature/student-phase`** (entrambi i repo sono lì).

Fronte attuale: redesign vista settimana home istruttore FATTO (vedi sotto). **Prossimo step: rifinire leggermente la home istruttore SETTIMANALE in stile ancora più Airbnb e più coerente col design system** — dettagli in fondo a questo file. (Lavoro precedente sulla home istruttore — header, calendario, FAB, quick-book — resta allo standard nuovo, vedi `docs/features/quick-book.md`.)

---

## Regole di lavoro (SEMPRE)

1. **Prima di QUALSIASI lavoro UI**: applica la skill **`/ui-ux-pro-max`** e leggi il design system.
2. **Design-first**: per UI nuove/non banali, definisci la direzione e — se serve — genera una preview (HTML in `plans/frontend/`, o nano-banana/Stitch) e falla approvare **prima** di toccare il codice di produzione.
3. **Niente deploy / OTA senza ok esplicito dell'utente.**
4. Decisioni di design: chiariscile **in chat** (non popup), a meno che l'utente non chieda i select.

---

## Design system — dove trovarlo

| Cosa | Dove |
|------|------|
| **Doc completo** | `reglo-mobile/docs/design-system.md` — leggilo prima di scrivere UI |
| Token colori / spacing / tipografia | `src/theme/colors.ts`, `spacing.ts`, `typography.ts` (export unificato `src/theme/index.ts`) |
| Mapping mobile↔web | `reglo/docs/design-system.md` sez. 10 (palette condivisa, stessi hex) |

**Palette: MONO-NAVY, niente rosa, si tiene il giallo.** `colors.primary = #1A1A2E`, `colors.accent = #FACC15`. La vecchia scala `pink` è ora `navy`. Scala navy: `50:#F4F5F9 100:#E9EBF2 200:#D6D9E6 300:#AEB4CC 400:#6E7596 500:#1A1A2E 600:#14141F 700:#0D0D16`. **Non reintrodurre il rosa.**

**Pattern già consolidati (seguirli, non reinventare):** design-system §6.3 (`Button.loading` = spinner, mai label-swap), §7.5 (form a card: card 3D bianca = primario · lista piatta = secondario · banner N50 = optional), §7.6 (ogni sotto-input apre una **route nativa** seminata via store+callback, con tabella route/store).

---

## Navigazione docs (prima di ogni modifica)

Ogni repo ha `docs/` con `INDEX.md`, `impact-map.md`, `features/`, `architecture/`. Mobile: `docs/INDEX.md` → feature → `features/<x>.md` → `impact-map.md`. Pattern riutilizzabili in `docs/patterns/`. Leggi anche `reglo-mobile/CLAUDE.md` e la root `/Users/tizianodifelice/CLAUDE.md`.

---

## Convenzioni e gotcha (per non sbatterci)

1. **Header blur collassabile → root `<View style={{flex:1}}>`, MAI `<Screen>`** (aggiunge `paddingTop: insets.top` → doppio padding, header rotto). L'inset si gestisce con una View padre attorno all'`Animated.ScrollView`. Vedi `docs/patterns/collapsible-hero-screen.md`.
2. **RN ignora `paddingTop` sullo `style` di uno ScrollView**: usa una View padre con padding.
3. **`contentContainerStyle.gap` si applica tra OGNI figlio diretto** dello ScrollView → gap fantasma; occhio a `stickyHeaderIndices` quando aggiungi/togli figli.
4. **Form sheet nativo content-hugging** = route Expo Router `presentation:'formSheet'` + `sheetAllowedDetents:'fitToContents'` + **NO ScrollView** + root senza `flex:1`. `NativeFormSheet` NON è nativo (è un `<Modal>` custom). Liste scrollabili a lunghezza variabile → `presentation:'modal'` (page sheet). Chiusura sheet = **X in alto a destra**, non handle.
5. **CTA dei picker** (`select-options`, `select-exam-students`): pill navy custom (`height 54, borderRadius 27`, ombra navy, testo bianco 600), NON il componente `Button`. Nei **footer dei form** (block-slot/sick-leave/create-exam) invece si usa `<Button loading>`.
6. **Font weight 500/600, mai 700/800** di default (l'utente odia il bold pesante).
7. **Edit tool**: em-dash `──` e `·` rompono il match esatto → `perl -i` per cancellazioni a range. `grep -Z` su macOS non emette null → `while IFS= read -r f`.
8. **Type-check mobile**: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TabNavigator" | grep "error TS"`. `noUnusedLocals` è OFF.

---

## Git — dove siamo

- Branch di sviluppo redesign: **`feature/student-phase`** su entrambi i repo. Branch prod: `main` (reglo) / `master` (reglo-mobile).
- **Lavora solo su `feature/student-phase`.** ⚠️ `master` mobile NON builda da solo (mancano ~66 asset che vivono solo su `feature/student-phase`): niente OTA da master.
- **Non deployare in prod da `feature/student-phase`**: spedirebbe tutto il redesign + WIP. Vale per Vercel (web) e per `trigger:deploy:prod` (usa il working tree corrente).
- C'è lavoro BE **non committato** nel repo `reglo` (audit priorità cluster→company: limite settimanale, cutoff, governance, cron notifiche slot vuoti per-cluster). Troppo divergente da `main` per cherry-pick: si rilascia col merge generale. Dettagli: memorie `project_cluster_settings_audit` + `feedback_cluster_overrides_company`.
- `git status` di reglo mostra anche `app/api/autoscuole/appointments/[id]/route.ts` e `app.json`: WIP pre-esistente, non toccarli senza capire cosa sono.
- Verifica divergenza prima di merge/deploy: `git rev-list --left-right --count origin/main...HEAD`.

---

## 📦 Checklist RILASCIO (quando si rilascia tutto)

1. **Web + backend `reglo`**: push su `main` → Vercel auto-deploya.
2. **DB migrations** (se schema cambiato): `pnpm migrate:prod` in `reglo/`. Include `20260609035024_drop_reposition_task` (DROP della tabella `AutoscuolaAppointmentRepositionTask` — repositioning ritirato), `20260609120000_add_vehicle_fixed_instructor` (veicolo fisso per istruttore: 2 colonne su `AutoscuolaVehicle`, additiva, nessun backfill) e `20260609140000_add_license_category` (categorie patente: `licenseCategory`/`transmission` su `AutoscuolaVehicle` NOT NULL default B/manual + su `CompanyMember` nullable, **backfill allievi → B/manuale**). Vedi `reglo/docs/prod-release-migrations.md` #8, #9 e #10. ⚠️ Le autoscuole moto dovranno ri-categorizzare veicoli e allievi dopo il rilascio (tutto parte come B manuale).
3. **Trigger.dev**: `pnpm trigger:deploy:prod` in `reglo/` — **OBBLIGATORIO**: (a) il cron notifiche slot vuoti (`communications.ts` → `processEmptySlotNotifications`) è per-cluster **e ora anche license-aware** (`freeSlotLicenseKeysTomorrow` filtra i candidati per categoria/cambio del veicolo libero, gated su `vehiclesEnabled`); (b) il job `autoscuole-reminders` non chiama più `processAutoscuolaPendingRepositions` (rimosso col ritiro repositioning). Senza redeploy gira la vecchia logica (allievi moto riceverebbero push per slot auto). Cron notifiche slot: `trigger/autoscuole-empty-slot-notifications.ts` (`0,30 * * * *`). Nota: la logica waitlist/swap license-aware (`broadcastWaitlistOffer`, `respondWaitlistOffer`, swap) vive in server action → coperta dal deploy Vercel, non da trigger.
4. **Mobile OTA**: `eas update --platform ios --branch production --message "..."` poi idem `--platform android` (MAI `--auto`, MAI `--platform all`).
5. **Bonifica proposte su PROD** — OBBLIGATORIO (già fatto su DEV il 2026-06-09). Dopo il deploy del backend, in `reglo/` lanciare lo script che cancella le proposte ancora "live" (+ rimborsa i crediti delle proposte future). Lo script **non** tocca più la tabella reposition task (droppata dalla migration #8), quindi è indipendente dall'ordine vs migrate:prod:
   ```
   DOTENV_CONFIG_PATH=.env.prod NODE_OPTIONS=--require=dotenv/config node scripts/retire-repositioning.mjs            # dry run (mostra cosa farebbe)
   DOTENV_CONFIG_PATH=.env.prod NODE_OPTIONS=--require=dotenv/config node scripts/retire-repositioning.mjs --apply    # esegue
   ```
   Senza questo, le proposte già esistenti restano appese in app come guide "Proposta" non più gestibili.
6. Al merge: ordinato `main`/`master` ↔ `feature/student-phase` (i fix prod del "riposizionamento" guide stanno su `main`/`master`, il redesign su `feature`).

---

## Stato corrente — caricamento dati home istruttore (perf)

Il giro di ottimizzazione del **caricamento dati** della home istruttore è FATTO (vedi git). Metodo seguito: performance playbook canonico `reglo/docs/architecture/performance-playbook.md` (memoria `reference_performance_playbook`).

Cosa è cambiato (per capire il comportamento attuale prima di toccare ancora `IstruttoreHomeScreen.tsx`):
- **`loadData(opts?: {force?})`**: bootstrap + settings + instructorSettings ora passano da `queryClient.fetchQuery` con gli stessi `queryKeys` dei TanStack hook → niente più doppia-fetch al cold start. `force` default **true** (mutazioni, pull-to-refresh = rete vera, `staleTime:0`); il **mount iniziale** e il **focus listener** passano `force:false` (riusano la cache fresca). I params bootstrap DEVONO restare identici a `useAgendaBootstrap.bootstrapParams` o si rompe il dedup.
- **Focus listener gated** (30s): tornare da uno sheet/tab non rilancia più 4 famiglie di fetch; il read del view-mode (locale) gira sempre.
- **Mount**: `loadOutOfAvailability` parallelo (non più concatenato dietro loadData).
- **BE** (`reglo/lib/actions/autoscuole.actions.ts`, `getAutoscuolaAgendaBootstrapAction`): i company-service limits ora via `getCachedCompanyServiceLimits` (Redis SETTINGS) e dentro il `Promise.all`. Nessuna migration. Si rilascia col merge generale di `feature/student-phase`; redeploy Vercel normale, **nessun** trigger:deploy richiesto da questa modifica.

Non fatto di proposito (rischio>beneficio): NON ho ridotto la finestra del fetch "featured" (`getAppointments` +60g) — `featuredAppointments` alimenta anche liste swap/raggruppamenti su finestra larga e gira già in parallelo al bootstrap (poco impatto sul percepito).

**Navigazione giorni istantanea (FATTO, vedi `plans/performance/003-...`)**: la home istruttore ora carica una **finestra** `-7/+21g` (stato `loadRange`, disaccoppiato da `selectedDate`, limit 400) e filtra il giorno **client-side** (`dayAppointments`). Selezionare un giorno dentro la finestra = zero rete, zero skeleton; la finestra si ricentra solo vicino al bordo (prefetch vicini). SWR: skeleton solo se non c'è nulla da dipingere (`dayGridLoading`/`appointmentsLoading`), + cross-fade (`timelineFadeSV`) sulla revalidation in background. `WeeklyAgendaView` filtra già per data esatta → riceve la finestra intera senza problemi. `calendarRange` resta = giorno/settimana per blocchi/malattia/prenotazione.

### Stato corrente — restyling Airbnb sezione "Altro" (FATTO)
Rifatte in stile **Airbnb / mono-navy / leggero** le schermate: `MoreScreen` (hero profilo grande + lista flat), `LocationsScreen` ("Luoghi guida": lista flat, tap riga → form, `•••` → ActionSheet, `+` nell'header), `more/profile-edit` (ora autonomo dalla session) e il formsheet `more/location-form`. **Tutti i formSheet** sono stati standardizzati: niente grabber, **X in alto a destra** (`sheetGrabberVisible: false` ovunque). Regole nuove scritte nel **design system** `docs/design-system.md` §14: (1) liste = righe FLAT sullo sfondo, MAI dentro una card (card solo per item singoli); (2) azioni di riga in menu nativo, tap = azione primaria; (3) "Aggiungi" = `+` nell'header; (4) formSheet = X, no grabber; (5) testo leggero (400 liste/body, 600 max titoli/nomi — vedi memoria `feedback_font_weight`).

### Sezione "Veicoli" (FATTO)
Restyling Veicoli completato in stile Airbnb/mono-navy. **Owner + Instructor unificati** in `src/screens/VehiclesScreen.tsx` (i due vecchi screen sono wrapper sottili). Lista flat (header large-title blur collassabile come `ClusterSettingsScreen`, righe icona+nome+targa, tap → form, `•••` → ActionSheet attiva/disattiva, inattivo = riga attenuata). Form = route formSheet `more/vehicle-form` (store `vehicleFormStore` seed-and-callback, X no-grabber, no ScrollView) + route `more/time-picker` (riuso `timePickerStore`); niente più `BottomSheet`/`TimePickerDrawer`. Rinominabili nome/targa, `ToggleSwitch` attivo/inattivo, editor disponibilità. **Tolto** il prefetch disponibilità per-riga (7×N richieste) dell'Owner: ora la disponibilità si carica solo nel form. Doc: `docs/features/vehicles.md`. Preview: `plans/frontend/004-veicoli-restyle-preview.html`.

### Vista settimana istruttore → "controllo in parole" (FATTO)
La vista settimana (`agendaViewMode === 'week'`) non è più una griglia oraria ma un'**agenda "controllo in parole"** (preview approvata `plans/frontend/008-...`): header su **pannello tonale** (range "8 – 13 Giugno" + Oggi + icona calendario, niente frecce), navigazione settimane via **swipe orizzontale nativo** (`FlatList` paginata su lista fissa di settimane → niente glitch di re-center). Ogni giorno = riga con **striscia-densità** (solo ritmo) + **riepilogo testuale** (n° guide/esami; "Riposo"/"Nessuna guida"); **tap → page sheet nativo** (`home/day-detail`) con l'itinerario completo (marker + card lezioni + band `Libero` con long-press quick-book preservato — il sheet è avvolto in `GestureHandlerRootView` + `ScrubBubble`). File chiave: `src/utils/weeklyAgenda.ts` (`computeDayPlan` puro), `src/components/WeeklyOverview.tsx`, `src/components/DayItinerary.tsx`, `src/stores/dayDetailStore.ts`, innesto in `IstruttoreHomeScreen.tsx` (rimpiazza `WeeklyAgendaView`, che resta solo per la home Titolare). Disponibilità: caricata 3 settimane keyed-per-data + **merge** (no flash); in day view cache per-giorno in `availabilityCacheRef` (stessa cura anti-glitch). Dettagli + cose da verificare su TestFlight: `plans/frontend/009-instructor-weekly-overview.md`.

### Prossimo step — rifinire la home istruttore SETTIMANALE (più Airbnb + design system)
Polish leggero della vista settimana (`WeeklyOverview` + `DayItinerary` + `home/day-detail`): allinearla ancora di più allo stile **Airbnb / mono-navy** e al **design system** (`docs/design-system.md`, specie §14 e i token `src/theme/`). Da rivedere con occhio fine: spaziature/ritmo verticale delle righe-giorno, tipografia (pesi 400/500/600, mai 700+), la striscia-densità (colori/altezza/raggi coerenti coi token), header tonale, il page sheet del giorno (titolo, X, card itinerario), micro-interazioni/press feedback. Niente stravolgimenti funzionali: solo qualità visiva e coerenza. **Prima**: applica `/ui-ux-pro-max` e rileggi `docs/design-system.md`.

### In sospeso (rimandato) — blocchi nell'agenda giornaliera istruttore
Fix della **visualizzazione dei blocchi** (blocca-slot, malattia/`sick_leave`) nella **vista giorno** di `IstruttoreHomeScreen.tsx`: come `blocksByHour` (filtrato per `calendarRange` = giorno) e gli `instructorBlocks` (finestra `loadRange` + sick wide) vengono renderizzati — posizionamento/altezza/overlap con le guide, blocchi multi-ora o a cavallo di mezzanotte, coerenza con `HOUR_SLOTS`.

Follow-up perf rimasti (minori): (1) stesso pattern a finestra per la **disponibilità** (`loadAvailability` rifà ancora per giorno, overlay non bloccante); (2) misurare su TestFlight che finestra 4-settimane + limit 400 copra gli istruttori più pieni.
