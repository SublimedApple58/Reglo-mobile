# Component & Screen Impact Map — Reglo Mobile

When modifying a feature, read its connected features to verify nothing breaks.

## Shared Component → Screens

| Component | Used by screens | Notes |
|-----------|----------------|-------|
| `src/components/clay/*` (clay v2, REG-639: `ClayButton`, `ClayIconButton`, `ClaySurface`, `ClayList/Row`, `ClaySearchField`, `ClaySegmented`, `Avatar`, `ClayMapControls`, `ClayStat`, `Icon3D`, e dalla notte del 28/10 `ClaySection`, `ClayToggle`, `ClayField`, `ClayEmpty`) + `theme/clay.ts`, icone 3D in `src/road/markerArt.ts` e `src/theme/moraleArt.ts` (§0.9) | Road: `drive/index`, `drive/avvia`, `app/road/index`, `riepilogo`, `segnala`, `home/road-*`, `manage-lesson-details` (variante `road`); dal 28/10 notte **tutta l'app istruttore/titolare**: Agenda (`IstruttoreHomeScreen`, `WeeklyAgendaView`, ~30 fogli di `home/`), Disponibilità (`InstructorAvailabilityScreen`, `DefaultAvailabilityEditor`, `PublicationModeEditor`, fogli di `role/`), tab «Tu» e sottosezioni (`MoreScreen`, `SettingsScreen`, `InstructorHoursScreen`, `VehiclesScreen`, `LocationsScreen`, `EvaluationSheetScreen`, `AppearanceSettingsScreen`, `OwnerInstructorScreen`, fogli di `more/`), `NotificationInboxScreen`, `RoadLessonCard`; **tutti i fogli** via la X (`SheetCloseButton`/`GlassCloseButton` → `ClayIconButton`) (la tab bar `AppTabBar` NON è clay: resta T1 piatta) | Toccare un preset di `CLAY_SHADOW` o un componente cambia tutte queste schermate. `RoadPressable`/`RoadAvatar` sono alias di `ClayPressable`/`Avatar`. Regole in design-system §0. |
| `src/components/SheetScaffold.tsx` (`FormSheet`, `useSheetDismissGuard`) + `src/utils/sheetPresentation.ts` (`FORM_SHEET`) | ~70 fogli `FORM_SHEET` in `home/`, `more/`, `role/`, `drive/`, `road/` | REG-639 fluidità: i fogli si chiudono trascinando giù / toccando fuori. Un foglio che salva deve passare `busy` (e `dirty` se perde modifiche); un foglio che chiude con effetti `closeOnGesture`. La testata fissa è trasparente a riposo. `useSheetAnticipate` (28/10): chi chiude contenuto in altezza annuncia i px all'inizio, il foglio si accorcia insieme (oggi solo Pagamenti); l'altezza annunciata vale finché la misura non la raggiunge, max 700 ms. |
| `src/components/FadeImage.tsx` + `src/services/userPhotos.ts` + `src/services/photoDiskCache.ts` (usati da `UserPhotoCircle` → `Avatar`) | tutti gli avatar (Allievi, Road, dettaglio allievo, picker, Tu), copertina sede (Disponibilità, Luoghi), foto profilo (Tu, Altro, editor) | Giro Road 28/10: `useUserPhotoUrl` restituisce `undefined` finché non si sa (skeleton), `null` senza foto. Mappa URL persistita in AsyncStorage `reglo.userPhotos.v1` (stale-while-revalidate); file foto in `cacheDirectory/photos/`. Entrambe svuotate all'uscita dall'account (`clearUserPhotoCache`). |
| `src/components/AppTabBar.tsx` + `src/components/tabBarSpace.ts` + `app/(tabs)/_layout.tsx` (`sceneStyle`, `FULL_PAGES`) | tutte le schermate dentro le tab (tutti i ruoli); radici istruttore sotto il vetro: `IstruttoreHomeScreen` (FAB), `WeeklyAgendaView` (griglia), `drive/index`, `InstructorNotesScreen`, `MoreScreen` | Giro Road 28/10: barra in vetro sopra le schermate. Nuova pagina a schermo pieno (non foglio) nelle pile `home`/`drive`/`notes`/`more` → aggiungerla a `FULL_PAGES`, altrimenti il fondo finisce sotto la barra. Nuova radice istruttore che scorre → `useTabBarOverlap()` in fondo. Tab Road: `useInstructorTabs` (cache impostazioni finché `roadStore.roadKnown` è falso) + velo in `AuthGate`. |
| `src/hooks/useStackBase.ts` | `DefaultAvailabilityEditor`, `PublicationModeEditor`, `InboxBellButton` | Fogli/route registrati in più stack (Disponibilità in `role/` e `home/`, notifiche in `home/` e `drive/`): una route nuova va aggiunta a tutti gli stack. |
| `src/components/clay/StretchyCover.tsx` (`useStretchyCover`, copertina elastica, REG-661) + `HeatHalo` in `src/components/road/RoadMapParts.tsx` | `drive/index` (home Road), `RoadHotspotsScreen` (REG-659, `parallax: 1`) | La copertina sta dietro lo scroll: con poco contenuto si allarga per portare il foglio alla tab bar. Un figlio nuovo della mappa va in un posto fisso (crash AIRMap). |
| `src/road/avvioFlow.ts` (`avvioStore`, cache `useRoadStudent` di `GET /road/students/[id]`) + `src/road/avvioParts.tsx` | `drive/avvia`, `drive/avvia-allievo`, `drive/avvia-parti`, `drive/index` («Entra in Road» → foglio 2), `StudentNotesDetailScreen` (riga «Road», chip «Percorso») e `StudentRoadSheet` (REG-663) | REG-662: i tre fogli si leggono la scelta dallo store; X = `router.dismissAll()` (chiude tutta la pila dello stack `drive`). La risposta di `/road/students/[id]` serve anche a REG-663. |
| `src/road/roadStore.ts` (`useRoadState` / `useRoadSelector`) | mappa dal vivo (`useRoadState`), `useInstructorTabs` (tab), `RoadController`, `riepilogo`, `segnala`, `drive/index` (selettori) | `useRoadState` ridisegna a ogni fix GPS: usarlo solo per la mappa dal vivo. |
| `BottomSheet` | CreateExam, IstruttoreHome, InstructorManage, LocationPickerSheet, NotificationOverlay, OwnerInstructor, RescheduleAppointmentSheet, TitolareHome (8) | iOS + Android separate implementations. ClusterSettings + Vehicles migrated to formSheet routes. |
| `TimePickerDrawer` | CreateExam, InstructorManage, OwnerInstructor, PublicationModeEditor, RescheduleAppointmentSheet, Settings (6) | Depends on BottomSheet. ClusterSettings + Vehicles now use the formSheet `time-picker` route (timePickerStore). |
| `CalendarDrawer` | AllievoHome, CreateExam, IstruttoreHome (3) | Depends on MiniCalendar + BottomSheet. (TitolareHome ora è un wrapper di IstruttoreHome.) |
| `RangesEditor` | InstructorManage, OwnerInstructor, PublicationModeEditor, DefaultAvailabilityEditor, role/availability-exception (5) | Time range format changes break all availability UIs. Navy clock circle (no pink). |
| `SelectableChip` | CalendarNavigator, ClusterSettings, InstructorManage, Settings (4) | |
| `WeeklyAgendaView` | IstruttoreHome (anche TitolareHome): vista **Settimana** dell'Agenda (REG-639; REG-638 aveva tolto `WeeklyOverview`, `WeeklyLiveCard`, `DayItinerary` e `home/day-detail`) | Hour-grid week view. Colori blocchi via `getLessonLook` → `agendaLook.guideLook`, veicolo nei blocchi (REG-633) via `utils/agendaVehicle.ts`. Intestazione dei giorni non tappabile. Blocco fantasma → card dei tipi → `onCreateAt` (REG-671). Props `createKinds`, `carColor`, `ghostIgnoresEvents` (più istruttori sulla griglia), `ghostResetKey`. È l'unica vista dell'Agenda. |
| `src/utils/agendaLook.ts` (REG-639) | `WeeklyAgendaView` | Unico punto dell'aspetto degli eventi (fondo pastello pieno, ombra in tinta `glow`, esami bianchi, gruppi verde/ambra, «Pausa»). Dipende da `agendaColors.ts` (`AGENDA_BLOCK_BAR` = false, `mixWithWhite`); il colore è sempre quello di «Aspetto agenda». |
| `ClayPageHeader` (`src/components/ClayPageHeader.tsx`, REG-639) | `MoreScreen`, `SettingsScreen`, `InstructorHoursScreen`, `VehiclesScreen`, `LocationsScreen`, `EvaluationSheetScreen`, `AppearanceSettingsScreen` (7) | Testata delle schermate intere clay (indietro + azioni, titolo 32/600, riga grigia). Stesso titolo della testata dell'Agenda (stili `hd` in `IstruttoreHomeScreen`, non condivisi: cambiarne uno → allineare l'altro). |
| `ClayAccountParts` (`ProfileSummaryCard`, `ClayTextRow`, `AppVersionFooter`, `CLAY_DANGER`) | `MoreScreen`, `SettingsScreen` (2) | Card profilo, righe di solo testo (rosso solo per azioni distruttive), piè di pagina versione. |
| `MORALE_ART` (`src/theme/moraleArt.ts`, `assets/morale/`) | (espresso oggi non usato), `NotificationInboxScreen` (aeroplanino), `LocationsScreen` / `VehiclesScreen` / `OwnerInstructorScreen` (piantina), `InstructorHoursScreen` (trofeo), `home/exam-manage` (esame) | Icone 3D AI «di morale», solo stati vuoti / traguardi / testata esame (design-system §0.9). |
| `assets/icons3d-ai/*` (REG-639, sostituti delle Fluent eliminate) | `lessonArt.ts` (auto/moto), `AllievoHomeScreen`, `StudentNotesDetailScreen`, `StudentSettingsSheet`, `GroupLessonInvitesScreen`, `SwapOffersScreen`, `StudentMyNotesScreen`, `home/booking-flow`, `home/exam-detail` | `require` diretto, mai `tintColor`. Tabella in design-system §0.9. |
| `AgendaTodayCard` (`src/components/agenda/AgendaTodayCard.tsx`) | `IstruttoreHomeScreen` (1) | Card «Oggi» dell'Agenda (giro «memorabile»): la riga segue la giornata (prima/in corso/prossima/domani) e a giornata finita mostra l'espresso (`MORALE_ART`). Legge SOLO gli appuntamenti già caricati dall'agenda: «domani» compare solo se è nel range caricato. |
| `MonthHoursCard` (`src/components/MonthHoursCard.tsx`) | `MoreScreen` («Tu») (1) | Ore del mese + barre delle settimane + frase di confronto col mese prima allo stesso giorno (solo se positiva). Fa **tre** chiamate `useInstructorHours` (mese, mese fino a oggi, mese prima fino allo stesso giorno). Lo stesso confronto per settimana vive in `InstructorHoursScreen`. |
| `RouteThumb`, `SessionNumbers`, `BriefingLines` (`src/components/road/RoadTabParts.tsx`) | `drive/index` (Ultime guide), `drive/appena-finita` (`SessionNumbers`) (2) | `RouteThumb` con `carColor` = auto 3D (`car34Art`) quando la guida non ha un percorso disegnabile, altrimenti la mappa. REG-658: `drive/index` apre anche `drive/sede-mancante` (una volta per avvio, `headquarters: null`), dopo «Appena finita» (`pagellinoPrompt.shownRecently`). `SessionNumbers` dice le segnalazioni a parole («1 fatta bene · **1 da ripassare**»): cambiarlo cambia anche il foglio «Appena finita». |
| `VITA_ART.salvadanaio` / `salvadanaioPieno` | `StudentPaymentsScreen` (hero 76 pt), `StudentNotesDetailScreen` (riga Pagamenti 46 pt) | Coppia: stessa forma (pieno generato con il normale come terza reference, design-system §0.9). Normale = da riscuotere, pieno = tutto saldato. |
| `BookingCelebration` | AllievoHome, NotificationOverlay, SwapOffers (3) | 2 variants: 'booking' and 'swap' |
| `LessonHistoryRow` (`src/components/student/`) | `StudentNotesDetailScreen` (ultime 5 + prossime), `LessonHistorySheet` (route `home/lesson-history`, `notes/lesson-history`, seed `lessonHistoryStore`) (2) | Riga guida in memo con le azioni dello storico (dettagli, esito esame, pagellino, Road). Cambiarla cambia scheda e «Vedi tutte». Vedi [features/dettaglio-allievo.md](features/dettaglio-allievo.md). |
| `StarRating` | IstruttoreHome (input), StudentMyNotes (display), StudentNotesDetail (display) (3) | |
| `RescheduleAppointmentSheet` | IstruttoreHome (1) | Complex: BottomSheet + CalendarDrawer + TimePickerDrawer |
| `BookingForm` | `home/new-booking` (`variant="full"`), `home/quick-guide` (`variant="quick"`, REG-671) | Form prenotazione. Legge `bookingSheetStore` (REG-671: `presetStudentId`, `suggestions`, `outsideAvailability`, `instructorOptions`). La logica (conferme, veicoli, moto, multipla) è una sola: modificarla cambia ENTRAMBE le route. Lista allievi = solo fase **PRATICA** (REG-499), filtrata in `IstruttoreHomeScreen.bookingStudentOptions` → cambia per ENTRAMBE. **Conferme del backend (REG-509)**: le risposte con `code` in `CONFIRMABLE_CODES` (`WEEKLY_LIMIT_CONFIRM`, `LESSON_BUFFER_CONFIRM`) NON sono errori — `runBooking` le ripropone con Annulla/Procedi e rimanda la conferma come flag, accumulandola alle precedenti. ⚠️ **Ogni nuovo `code` di conferma aggiunto lato server va aggiunto a quell'elenco**, altrimenti finisce nell'alert generico «Errore … OK» che ha un solo bottone e l'azione diventa impossibile da app (era il bug REG-509).  **Prenotazione multipla (REG-608)**: `confirmMulti` fa prima una **prova a vuoto** (`checkInstructorBookingBatch`) e, se qualche data è occupata, apre `FollowCarConflictSheet` per scegliere l'auto al seguito sostitutiva **per data**; `entries[].followVehicleId` ha tre stati (assente = eredita, `null` = nessuna, id = quella). Toccare `batchSharedPayload()` cambia sia la prova a vuoto sia la creazione vera — sono la stessa cosa vista due volte. |
| `BlockForm` | `home/block-slot`, `home/theory-lesson` (`full`), `home/quick-block` (`quick`, REG-671) | Form blocca slot / lezione teorica. Legge `blockSheetStore` (`instructorOptions` per il titolare). Modificarlo cambia tutte le route. |
| `FollowCarConflictSheet` | `home/follow-car-conflict` (hug, 1-3 conflitti), `home/follow-car-conflict-long` (page sheet, 4+) (2) | Foglio «Auto al seguito occupata» della prenotazione multipla (REG-608). Legge `followCarConflictStore`; la scelta dell'auto riusa `optionsPickerStore` (foglio sopra foglio, nessun elenco annidato). ⚠️ La versione hug **non deve** contenere una ScrollView: `fitToContents` non la misura e il foglio si rompe — se il contenuto cresce, si passa alla rotta `-long`. Testi identici al gemello web `FollowCarConflictPane` (REG-613): cambiarne uno solo fa divergere le due piattaforme. |
| `MiniCalendar` | InstructorManage, OwnerInstructor, role/availability-exception + used by CalendarDrawer (4) | Navy selected/today/dot (no yellow/pink). |
| `InfoBanner` | BookingForm (`filled`), StudentNotesDetail (`quiet`) (2) | **Due forme per due mestieri**: `filled` contiene un controllo che si usa (sfondo pieno, icona nel cerchio, toggle a destra), `quiet` dice soltanto cosa stai guardando (niente riempimento, filetto sotto, occhiello + valore, freccia iOS senza sottolineatura). Le misure di `filled` sono quelle del banner «Prenotazione multipla» da cui nasce: **non spostarle**, o si sposta il form di prenotazione. Il movimento vive nel componente (tocco con scala + haptic, testi in dissolvenza sulla chiave del valore, freccia che ruota con `actionFlipped`, larghezza che scivola), quindi **entrambe le schermate lo ereditano**: cambiarlo le cambia tutte e due. |

## API Type → Screens

| Type | Used by (screen count) |
|------|----------------------|
| `AutoscuolaAppointmentWithRelations` | AllievoHome, IstruttoreHome, TitolareHome, InstructorManage, NotificationOverlay, RescheduleAppointmentSheet, notes screens, LessonsOverview (15) — since 2026-06-24 carries `followVehicle` (auto al seguito); a moto lesson reserves **2 vehicles** (moto + follow car). Since 2026-07-20 carries `cancelledAt/penaltyAmount/penaltyCutoffAt/lateCancellationAction` (dal ramo backend `light`), consumati da `LessonsOverview` segmento "Annullate". Since REG-399 carries `motoLessonType` (`'birilli'\|'strada'\|null`) — guide **individuali**: selettore in creazione (`BookingForm`), riga read-only `manage-lesson`, chip `StudentNotesDetailScreen`. Since REG-406 carries `groupLessonMotoType` (annotazione bootstrap agenda) per le guide di **gruppo moto** — selettore in creazione (`CreateGroupLessonScreen`), riga read-only `manage-group-lesson`, badge chip `DayItinerary`; vedi [features/moto-lesson-type.md](features/moto-lesson-type.md). Display it wherever `vehicle.name` is shown. |
| `InstructorClusterSettings` | Settings, InstructorAvailability, IstruttoreHome, InstructorNotes, CreateExam, ClusterSettings, InstructorManage, PublicationModeEditor (9) |
| `AutoscuolaSettings.agendaShowVehicle` (REG-633) | WeeklyAgendaView via `src/utils/agendaVehicle.ts`; scritto da `AppearanceSettingsScreen` (endpoint scoped `agenda-colors`). |
| `AutoscuolaSettings.agendaColor*` (`agendaColorCriterion`/`Overrides`/`Exceptions`) | `WeeklyAgendaView` via `src/utils/agendaLook.ts` → `src/utils/agendaColors.ts` — colore blocchi guida in agenda. Già nel payload di `GET /api/autoscuole/settings`. Vedi [features/agenda-block-colors.md](features/agenda-block-colors.md). |
| `AutoscuolaStudent` | NotificationOverlay, CreateExam, notes screens (7) |
| `AutoscuolaAppointment.manualPaymentStatus` / `creditApplied` / `paymentRequired` | `StudentPaymentsScreen`, `StudentNotesDetailScreen` (conteggio "da pagare") via `src/utils/lessonPayments.ts` (REG-450). **Solo ramo full** di `getAppointments`. Vedi [features/lesson-payments.md](features/lesson-payments.md). |
| `AutoscuolaAppointment.paymentHistory` (REG-637) | `StudentPaymentsScreen` (riga chi/quando + tocco → `payment-history`), `PaymentHistorySheet`. Solo staff, solo `getAppointments({ studentId })` ramo full. Regola gemella `src/utils/paymentHistory.ts` ↔ `reglo/components/pages/Autoscuole/LessonPaymentTrail.tsx`. |
| `AutoscuolaSettings.roadEnabled` + tipi `Road*` (REG-638) | `useRoadEnabled` (vale solo `=== true`) → `RoadController` (AuthGate), `IstruttoreHomeScreen` (live card), `app/road/*`, `lesson-detail` (allievo, `RoadDetail`). Contratto: `reglo/docs/features/reglo-road.md`. |
| `NotificationItem` | NotificationOverlay, NotificationInboxScreen, notificationStore (3) |

## Feature Adjacency

### Booking Flow
- → **Notifications**: booking success can trigger proposal/confirmation notifications
- → **Settings**: booking governance (limits, cutoff, actors) configured in settings
- → **Backend**: `createBookingRequest()`, `getAvailableSlots()`, `getBookingOptions()`

### Guide annullate (vista allievo)
- **Componente condiviso** `src/components/ledger/LedgerUI.tsx` (`LedgerFilterBar`, `StateGlyph`, `TONE`, `formatEuro`, stili `ledger`) usato da `StudentPaymentsScreen` **e** `LessonsOverview`. Toccarlo cambia ENTRAMBE le schermate. `formatEuro` accetta `number | string` perché i `Decimal` di Prisma arrivano come stringa: era la causa del crash REG-511, e sta qui perché ne esista una sola copia.
- **Componente condiviso** `LessonsOverview` (filtri Tutte | Programmate | Svolte | Annullate, REG-510) usato da 2 punti d'accesso: `home/all-lessons` (sheet seedato, card tappabili via `allLessonsStore`) e `settings/le-tue-guide` (Profilo allievo, non tappabili). Cambiare `LessonsOverview` impatta ENTRAMBE le route — **lo storico compare quindi in entrambe**, mentre la Home allievo resta senza guide passate (finestra −7 giorni, invariata).
- → **Booking Flow**: le "Programmate" sono le guide future dell'allievo; il tap sulla card home riapre il dettaglio guida.
- → **SettingsScreen** (Profilo allievo): la voce "Le tue guide" è nel `renderStudentContent`; toccare le righe del Profilo può nasconderla/spostarla.
- → **Backend (`reglo`)**: nessun endpoint nuovo — `getAppointments`/`useAppointments` con `status:'cancelled'` + `light`. Il segmento Annullate filtra `cancellationKind === 'manual_cancel'` (esclude `record_cleanup`/organizzative). Se cambiano i campi annullamento (`cancelledAt/penaltyCutoffAt/penaltyAmount/lateCancellationAction`) o i valori di `cancellationKind`, aggiornare badge + filtro.

### Availability Editor
- → **Booking Flow**: published availability determines bookable slots for students
- → **Settings**: `availabilityMode` toggle (default vs publication) lives in Settings (chosen there, NOT in the Disponibilità screen)
- → **Backend**: `setDailyAvailabilityOverride()`, `setRecurringAvailabilityOverride()`, `deleteDailyAvailabilityOverride()`, `createAvailabilitySlots()`, `publishWeek()`, `unpublishWeek()`
- **Live tree:** `app/(tabs)/role/` stack → `InstructorAvailabilityScreen` (shell, collapsible BlurView header) → `DefaultAvailabilityEditor` (Orari settimanali per-weekday + Eccezioni; full-stack `scheduleByDay`) or `PublicationModeEditor`. Exceptions edited via the `role/availability-exception` page-sheet (`availabilityExceptionStore`). `InstructorManageScreen` + its `AvailabilityEditor` are **legacy/unmounted** (React-Navigation `TabNavigator`, not in Expo Router tree).

### Swaps
- → **Notifications**: swap offers arrive via push → NotificationOverlay
- → **Booking Flow**: accepted swap changes student's schedule
- → **Settings**: swap enabled flag from company settings
- → **Backend**: `createSwapOffer()`, `respondSwapOffer()`, credit adjustments

### Notifications
- → **ALL features**: NotificationOverlay routes intents to all screens
- → **Agenda istruttore**: nell'app istruttore l'inbox si apre dalla campanella dell'Agenda; `NotificationInboxScreen` mostra l'indietro anche quando è la tab (`INSTRUCTOR`/`INSTRUCTOR_OWNER`). Notifiche raggruppate per giorno (`ClaySection`), stato vuoto `MORALE_ART.aeroplanino` (REG-639).
- → **Backend**: recovery endpoint, push token management
- → **Types**: `NotificationItem` union, `PersistedNotification`, notification store

### Settings
- → **Session & Auth**: «Esci» (`signOut`) per istruttore/titolare sta nella tab «Tu» (`MoreScreen`), non più nelle Impostazioni staff (che tengono solo «Elimina account»); l'allievo lo tiene nel Profilo (REG-639).
- → **Auth/Signup**: card "Codice di invito" in ClusterSettingsScreen; lo stesso codice è accettato dal campo signup (`SignupScreen`, wire field `schoolCode`) e assegna l'allievo all'istruttore
- → **Availability Editor**: availabilityMode toggle
- → **Instructor Manage**: cluster settings (durations, booking actors, limits)
- → **Backend**: `getAutoscuolaSettings()`, `updateInstructorSettings()`

### Foto profilo + Firma allievo
- → **Settings**: righe media dentro `profile-edit` (feature Settings); avatar della profile card in `SettingsScreen` mostra la foto
- → **Session**: `refreshMe()` dopo ogni upload; `user.photoUrl/signatureUrl` arrivano SOLO da `/api/mobile/me`
- → **API Layer**: `apiClient` ora supporta `FormData` (ogni futura modifica al client deve preservare il branch multipart)
- → **Backend web**: download originale/portale nel dettaglio allievo (vedi `reglo/docs/features/student-photo-signature.md`)
- ⚠️ **Build nativa richiesta**: `expo-image-picker` non è nel binario 2.1.0 → NO OTA finché non si builda con bump runtime

### Associazione istruttore via QR (REG-451)
- → **Settings**: riga "Scansiona QR" nel Profilo allievo.
- → **Root layout / AuthGate**: consuma il codice pendente del deep link; `+native-intent.tsx` è il primo file di riscrittura link dell'app (aggiungere lì eventuali altri deep link).
- → **Booking / cluster**: cambiare istruttore cambia le impostazioni effettive se è autonomo → invalidazione globale delle query.

### Pagellino di valutazione (REG-443)
- → **Dettagli guida**: la sezione vive dentro `home/manage-lesson-details`, sotto la valutazione complessiva; se il backend risponde `enabled:false` la schermata resta esattamente quella di prima
- → **StarRating**: ora accetta `total` (3 o 5). La valutazione complessiva continua a passare il default 5 — nessun call-site esistente cambia
- ⚠️ **`StudentNotesDetailScreen` legge gli allievi da `regloApi.getStudents()` → `/api/autoscuole/students`**, NON da `instructor-settings`. REG-458 ci e' inciampato: `lastObtainedLicense` era stato aggiunto a `instructor-settings`, il tipo mobile lo dichiarava sul tipo allievo, e la riga «Gia' conseguita» e' rimasta vuota **per tutti** dal rilascio (8/10) al fix (9/10). Il tipo che promette un campo non garantisce che l'endpoint lo mandi: contratto legato da `tests/e2e/reg458-students-obtained.spec.ts` nel repo web.
- → **Salvataggio**: `ManageLessonDetailsPayload.evaluations` attraversa i DUE opener del foglio (`IstruttoreHomeScreen`, `StudentNotesDetailScreen`): se ne aggiungi un terzo, ricordati di inoltrarlo o i voti si perdono in silenzio
- → **Backend**: contratto `GET /api/autoscuole/appointments/:id/evaluation` + campo `evaluations` nella PATCH dei dettagli (reglo `docs/features/evaluation-sheet.md`)
- → **Altro (MoreScreen)**: la riga "Pagellino" sta nella sezione Gestione, visibile a titolari E istruttori — chi cambia quel gate deve cambiare anche `saveEvaluationSheet` lato reglo, dove sta il permesso vero
- → **Configurazione**: `GET`/`PUT /api/autoscuole/evaluation-sheet` è lo stesso contratto del pane Impostazioni web; il salvataggio SOSTITUISCE l'elenco e ARCHIVIA le voci tolte — le costanti in `src/utils/evaluationSheet.ts` (scale, max 40, 60 caratteri, modello base) sono gemelle di quelle in `reglo/lib/autoscuole/evaluation-sheet.ts` e vanno cambiate insieme
- → **Form sheet nativi**: `evaluation-item` usa `HUG_SHEET` e le misure §13.2.1 del design system (testata 26/26 perché ha titolo+sottotitolo+bottoncini)

### Reglo Road (REG-638)
- **Punti critici (REG-646 → REG-666)**: `drive/punti-critici` (`RoadHotspotsMapScreen`, modale a tutto schermo: mappa + foglio lista; `hotspotMapStore` per il punto da inquadrare, usato anche dalla miniatura di `RoadHotspotSheet` e dalla copertina della tab Road) e `drive/punto-critico` (`RoadHotspotSheet`) leggono `src/road/hotspotsStore.ts`, scaldato dalla tab Road (`HotspotsEntry` in `drive/index`). Il foglio apre `drive/road-percorso` via `roadRouteMapStore`. `RoadMarkerPin` ha `onPress` (nel confronto del memo). Contratto: `reglo/docs/features/reglo-road.md` › Punti critici.
- **Giro della prossima guida (REG-649)**: `src/road/planStore.ts` (`GET /road/plan`) è letto da `drive/index` (riga nel briefing + tappe sulla mappa, pannello agenda), `drive/avvia`, `home/road-invite`, `home/manage-lesson` (tutti con `RoadPlanRow`, miniatura; REG-669) e scaldato da `RoadController`; `entryFlow.beginRoadEntry`, `road-privacy` e `enterRoadFree` mandano le tappe scelte (`plan`) a `POST /road/sessions` e `/road/free`. Tipi `RoadPlan*` in `regloApi.ts` = `reglo/lib/autoscuole/road/lesson-plan.ts`. REG-668: il giro modificato è per guida (`appointmentId`) e si salva su `GET/PUT/DELETE /road/plan/saved` (`prefetchSavedPlan`, `savePlanOverride`, `resetPlanOverride`); alla partenza il server lo usa e lo segna `plan.custom` (`roadGuide` non riottimizza).
- **Avvisi delle tappe (REG-650)**: `src/road/planAlerts.ts` gira in `roadStore.ingestPoints` (punti da `tracking.ts`) su `RoadSession.plan` salvato da REG-649; interruttore `planAlertsEnabled` da `/road/state` (`RoadController`); card in `app/road/index.tsx` (accanto ai toast di segnalazione e Road libero); esito in `app/road/riepilogo.tsx` da `planReached` di `POST /road/sessions/:id/end` (backend REG-648, raggio 40 m uguale a `PLAN_REACHED_M`).
- **Mappa del giro in Road (REG-652)**: `src/road/roadGuide.ts` chiama `POST /road/plan/route` (backend REG-648/653: `line`, `order`, `end`) e `GET /road/plan` (`studentHotspots`); `RoadGuideOverlay` usa `RoadMarkerPin` di `RoadMapParts` (anche di `RoadHotspotsScreen` REG-646, nuovo prop `hidden` opzionale) e sta nella MapView di `app/road/index.tsx` a posti fissi; l'ordine delle tappe (`guide.stops`) è anche quello degli avvisi di REG-650.
- **Riaggancio (REG-654)**: `src/road/reroute.ts` gira in `roadStore.ingestPoints` e usa `planProgress.reached` di REG-650 (ora calcolato anche con gli avvisi spenti); il ricalcolo chiama lo stesso `POST /road/plan/route` di REG-652 con `optimize: false` e le tappe rimaste (contratto backend REG-653: `stops: []` ammesso); `RoadGuideOverlay` ha il prop `skipped` e due Polyline in più.
- **AuthGate** (`app/_layout.tsx`): il gruppo `road` è ammesso accanto a `(tabs)`; `RoadController` instrada su `/road` finché `roadStore.phase !== 'idle'`. Toccare l'AuthGate può buttare fuori da Road a metà guida.
- **Pagellino (REG-443)**: `manage-lesson-details` ha la variante `road` (solo pagellino, CTA nera) ed è registrato anche in `app/road/` (re-export) + `select-options(-long)`. Cambiare il foglio cambia anche il pagellino di Road; cambiare il calcolo «N voci su M» del riepilogo richiede `AppointmentEvaluation` (`getAppointmentEvaluation`).
- **IstruttoreHomeScreen** (WeeklyLiveCard rimossa il 28/10 con la vista settimana): prop `onEnterRoad` solo se la guida «In corso» è la `eligibleLesson` di `/road/state`.
- **lesson-detail (allievo)**: blocco «Il tuo percorso» solo per guide `completed`; il server decide visibilità (`studentNotesEnabled`).
- **entry.ts**: è il `main` del package e definisce il task GPS prima di Expo Router: rimuoverlo rompe il tracking in background.
- **Nativo**: `react-native-maps`, `expo-location`, `expo-task-manager`, `expo-keep-awake` → runtime 2.4.0; nessun OTA che li usi può andare ai binari 2.3.0.

### Exam Creation
- → **Booking Flow**: exam is a special appointment type
- → **Settings**: reads cluster config for student grouping
- → **Backend**: `createExam()`, `getStudents()`, `getInstructorSettings()`
- → **Pronto per l'esame**: il picker (`select-exam-students`) differenzia i pronti (badge + anello + ordine); flag non vincolante

### Esito esame (REG-513)
- → **Foglio esame istruttore** (`home/exam-manage`): pastiglia sulla riga + "Registra esito" nel menu •••. Non chiede il numero di patente (lo inserisce il web).
- → **Dettaglio allievo** (`StudentNotesDetailScreen`, rotte `home/student-detail` + `notes/[studentId]`): pastiglia dell'esito sulla riga dell'esame nello storico, toccabile per registrarlo/cambiarlo. Ricarica `loadData()` dopo il salvataggio (la fase in testa cambia insieme all'esito). Menu e regole condivisi in `src/utils/examOutcome.ts`.
- → **Picker allievo della prenotazione**: un **idoneo** porta l'allievo a PATENTATO, che il picker esclude (mostra solo PRATICA, REG-499). Chi segna un idoneo non troverà più quell'allievo fra i prenotabili.
- → **Pronto per l'esame**: `examReady` si azzera uscendo da PRATICA, quindi un idoneo lo spegne.

### Pronto per l'esame (exam-ready)
- → **Notes (istruttore)**: toggle in `StudentNotesDetailScreen` (solo PRATICA), `setStudentExamReady`
- → **Exam Creation**: badge "Pronto" nel picker + ordine pronti-in-cima
- → **Backend**: `PATCH /api/autoscuole/students/:id/exam-ready`; `AutoscuolaStudent.examReady`, `getInstructorSettings().students[].examReady`

### Group Lessons (manage)
- → **IstruttoreHome**: `openGroupLessonManage(groupLessonId)` opens `home/manage-group-lesson` (page sheet) from both the day-detail card and the hour-grid card (`openLessonDrawer` short-circuit on `type==='group_lesson'`). Refreshes via `loadData()` on `onChanged`.
- → **Pickers (reused)**: `manage-lesson-instructor` (instructorPickerStore), `select-options` (optionsPickerStore — veicolo / durata / aggiungi-allievo), `select-date` (dayPickerStore), `time-picker` (timePickerStore). Changing any of these shared picker stores/routes affects this modal too ⚠️ `OptionsPickerSheet` dal 14/10/2026 (REG-617) mostra **da solo** un campo di ricerca oltre le 8 voci, ma **solo nella variante `scrollable`**: chi aggiunge un picker lungo ce l'ha gratis, chi tocca il componente deve ricordare che un `fitToContents` non si rimisura a ogni lettera. Lo stato vuoto è per-chiamata (`emptyLabel`), perché il foglio serve allievi, veicoli e durate. Dal 27/10/2026 (REG-636) le voci possono avere `subtitleTone` (verde/arancio con pallino o icona scambio) e `trailingInitials`, e il foglio una `footnote` sotto la lista — usati dal picker moto dei gruppi, opzionali per tutti gli altri.
- → **Backend**: `getGroupLesson` (GET, now returns `participants[].notes`), `updateGroupLesson` (PATCH — applies to all participants), `cancelGroupLesson`, `add/removeGroupLessonParticipant`, `inviteToGroupLesson`, `getEligibleGroupLessonInvitees`, `getInstructors`, `getVehicles`.
- → **Notes (per-allievo, 2026-06-16)**: the roster (`manage-group-lesson-participants`) writes a per-student note via `updateAppointmentDetails(appointmentId, {notes})` on the seat appointment. The student reads it in **StudentMyNotes** (teal `group_lesson` card) — same `getAppointments` path, no new endpoint.
- → **Vehicles**: vehicle picker subtitle uses `plate` + `licenseCategory`; gated on `settings.vehiclesEnabled`.

### Instructor Manage
- → **Availability Editor**: overlaps in override management (MiniCalendar, RangesEditor)
- → **Notifications**: appointment changes trigger push
- → **Notes**: appointment editing includes notes/ratings
- → **Backend**: 15+ API functions (appointments, availability, settings)

### Agenda istruttore (REG-639 clay)
- → **Creazione dall'agenda (REG-671)**: blocco fantasma → card dei tipi → `handleCreateAt` → `home/quick-student` → `home/quick-guide` (Guida), `home/quick-block` (Blocca/Teoria), `home/create-exam`, `home/create-group-lesson`.
- → **Colori blocchi agenda**: `agendaLook` / `agendaColors` (vedi sotto).
- → **Availability Editor**: le finestre di disponibilità (21 × `getAvailabilitySlots`, ricaricate per **settimana**, non per giorno) disegnano la tinta di disponibilità della griglia; dopo una modifica alla disponibilità il focus ricarica i dati.
- → **Group Lessons / Exam Creation / Esito esame / Instructor Manage / Lezione teorica**: tutti i fogli di gestione si aprono da qui (`manage-lesson`, `exam-manage`, `manage-group-lesson`, `add-action` «Nuovo»), tutti `FORM_SHEET` + `<FormSheet>`.
- → **Notifications**: campanella (`InboxBellButton`) in testata nell'app istruttore; l'inbox ha l'indietro anche da tab.

### Colori blocchi agenda (criterio Aspetto)
- → **Agenda istruttore** ([agenda-istruttore.md](features/agenda-istruttore.md)): dal 29/10 (REG-639) il blocco è a fondo pastello pieno, senza bordo, con ombra morbida in tinta (`agendaLook.guideLook`) nella griglia `WeeklyAgendaView`; il colore è esattamente quello di «Aspetto agenda», blu compresi (Tiziano 29/10). Esami/gruppi/blocchi e stati annullata/assente non passano dal criterio. (`DayItinerary` / `itinCard` eliminati, storico.)
- → **Settings**: legge `agendaColor*` da `AutoscuolaSettings` (`GET /api/autoscuole/settings`). Lettura ovunque; **scrittura staff (istruttori + titolari)** dal pannello `AppearanceSettingsScreen` (`Altro → Aspetto agenda`, gate `isInstructor||isOwner`) via endpoint **scoped** `PATCH /api/autoscuole/agenda-colors` → `regloApi.updateAgendaColorSettings` + `setQueryData` sulla cache `useAutoscuolaSettings` (le agende rileggono). Il picker colori è `more/color-picker` (`colorPickerStore`). Backend scoped `updateAgendaColorSettings` (`canManageAgendaColors`) scrive solo i 3 campi → permesso allargato in sicurezza.
- → **Student moto experience / Vehicles**: le eccezioni usano `student.licenseCategory`/`transmission`/`examReady` + `isMotoLicenseCategory`. Se cambiano quei campi o gli hex/soglie web (`reglo/lib/autoscuole/agenda-color-criterion.ts`), aggiornare `src/utils/agendaColors.ts` in parallelo (palette duplicata client-side).
- → **Backend**: nessuna modifica (dati già esposti).

### Lezione teorica (agenda)
- **È un** `InstructorBlock` con `reason:"theory_lesson"` (endpoint `createInstructorBlock` riusato; nessun tipo/route nuovi)
- → **Quick-book**: condivide `BlockForm`/`blockSheetStore` (`kind`); NON nel segmentato quick-book (solo menu ＋)
- → **Instructor Manage / agenda**: rendering in `IstruttoreHomeScreen` (giornaliera + dot), `DayItinerary`, `WeeklyAgendaView` (`weeklyAgenda.BLOCK_PRESENTATION.theory`) — card piena in tinta, non muted
- → **Backend**: nessuna modifica; passa dai check di disponibilità esistenti

### Pagamenti guide (REG-450)
- → **Lista Allievi (`InstructorNotesScreen`)**: seconda riga con «N da pagare» (`isLessonUnpaid` sulle guide della lista, manuale da `getAutoscuolaSettings`); nero 600 solo da 3 in su.
- → **Dettaglio allievo (`StudentNotesDetailScreen`)**: ci vive il blocco "Pagamenti" (visibile SOLO in modalità manuale) e da lì si apre `student-payments`. Chi tocca `loadData` deve continuare a riempire **`allAppointments`** (storico GREZZO, annullate comprese) e **`paymentSettings`**: la schermata pagamenti non fa fetch propri, legge solo il seed dello store. Se qualcuno rifiltra le annullate a monte, i filtri "Annullate" e le penali tardive spariscono in silenzio.
- → **Due stack**: `student-payments` è registrata in `home/_layout` E `notes/_layout` (la scheda allievo si apre da entrambi). Aggiungerne un terzo significa registrarla anche lì.
- **Regola gemella** `src/utils/lessonPayments.ts` ↔ `reglo/lib/autoscuole/unpaid-auto-block.ts` (`isCompanyManualMode`, `isLessonUnpaid`): stessa definizione di "guida da pagare" che alimenta badge web, contatore lista allievi e **blocco automatico prenotazioni per debito**. Vanno cambiate INSIEME.
- → **Guide annullate**: una annullata con `lateCancellationAction === 'charged'` e `manualPaymentStatus === 'unpaid'` è una guida **da pagare**. Se cambiano i valori di `lateCancellationAction`, aggiornare entrambe le copie.
- → **API Layer**: `manualPaymentStatus` arriva SOLO dal ramo **full** di `getAppointments` (il ramo `light` non lo seleziona) — una vista seedata `light` mostrerebbe tutto come non pagato. `lessonCreditsRequired` arriva da `GET /api/autoscuole/settings`.
- → **Session**: l'azione si disegna se `autoscuolaRole` è staff (OWNER / INSTRUCTOR_OWNER / INSTRUCTOR) — `canManageLessonPayments`. **Nessuna restrizione per guida**: dal 18/09/2026 anche l'istruttore segna le guide dei colleghi (l'incasso è amministrativo, non didattico). Se cambi questa regola, cambia anche la gemella BE `reglo/lib/autoscuole/lesson-payments.ts` + il suo test, o il pulsante compare e poi fallisce.
- → **Backend (`reglo`)**: `PATCH /api/autoscuole/appointments/:id/manual-payment` → azione `setManualPaymentStatus`, permesso scoped `canManageLessonPayments` (`lib/autoscuole/lesson-payments.ts`, unit-testato). I **crediti** restano owner/admin (`canManageStudentCredits`): "Copri con credito" del web NON è stato portato su mobile.

### Dettaglio allievo
- → **Pagamenti guide**, **Pagellino**, **Esito esame**, **Reglo Road**, **Percorsi patente**: tutte agganciate alle righe di `LessonHistoryRow`; il foglio `lesson-history` usa gli stessi handler via `lessonHistoryStore`. Vedi [features/dettaglio-allievo.md](features/dettaglio-allievo.md).

### Notes
- → **Instructor Manage**: notes are part of appointment detail editing
- → **Backend**: `getLatestStudentAppointmentNote()`, `updateAppointmentDetails()`

### Quiz Teoria
- → **Settings**: legge `quizSeats` / `phasesEnabled` / `autoAssignQuizOnSignup` via `/api/autoscuole/me`. Il legacy `quizEnabled` resta come fallback difensivo per backend più vecchi.
- → **Student Phase**: la tab `quiz` è visibile **solo** se `studentPhase === TEORIA && hasQuizAccess === true`. In AWAITING / PRATICA / PATENTATO la tab è nascosta.
- → **Tab Layout**: conditional quiz tab in `_layout.tsx`, con `hasQuizAccess` come segnale primario.
- → **Backend**: 7 API functions (chapters, sessions, answers, stats)
- → Self-contained: QuizContext holds session state, 3 screens

### Percorsi patente multipli (REG-458)
- **`useStudentPhase().obtainedLicenses`** (da `/api/autoscuole/me`) → `AllievoLicensedScreen`, che ora nomina la patente conseguita invece di un generico "hai concluso".
- **`obtainedLicenses`** sull'elemento `students` di **`/api/autoscuole/students`** (`regloApi.getStudents()`) → chip «ha già A2» sul fronte e riga «Già conseguita» sul retro della scheda di `StudentNotesDetailScreen`.
  ⚠️ **Era documentato (ed era scritto) su `/api/autoscuole/instructor-settings`, che quella schermata NON legge.** Il tipo mobile dichiarava il campo, il backend non lo mandava, TypeScript non poteva accorgersene: la riga è rimasta vuota **per tutti** dal rilascio (8/10) al fix (9/10). Lo stesso fatto esce da tre endpoint diversi (`/me` per l'allievo, `/students` per l'istruttore, i server action per il web): **prima di aggiungere un campo, verifica quale dei tre legge la schermata.**
  E non sono «tutte le conseguite» ma `licensesObtainedBeforeCurrent()`: in produzione 71 patentati su 72 hanno un percorso solo, e mandare anche quello voleva dire scrivere «ha già la B» accanto al chip «B · Manuale». Legato da `../reglo/tests/e2e/reg458-students-obtained.spec.ts`.
- Nuovo kind di notifica **`license_path_started`** (inbox + push). NON riusare `student_phase_change` per un riavvio: direbbe «le tue **prime** guide» a un patentato.
- ⚠️ `PhaseTimeline` è usata solo da `AllievoAwaitingScreen` con fase fissa: chi riparte non la vede. Se un domani comparisse in PRATICA va resa consapevole dello storico, altrimenti regredisce in silenzio.
- **Il filtro per percorso vive su quattro superfici** e il bug è ricomparso identico a ogni superficie dimenticata: web (`AutoscuoleStudentsPage`, `ConsorzioStudentDrawer`), app allievo (`LessonsOverview`), app istruttore (`StudentNotesDetailScreen`). Regola unica: `lessonsPathFilterId()` — gemello mobile in `src/utils/licensePaths.ts`, **da tenere allineato** col web (i test stanno solo lì).
- ⚠️ **Il movimento è parte del filtro, non una rifinitura.** In entrambe le liste la dissolvenza dipende da una **chiave** che deve contenere il percorso: in `LessonsOverview` la chiave della lista conteneva il tab ma non il percorso, e «Vedi tutte» faceva comparire le guide vecchie di scatto. Un solo movimento (l'altezza che scorre, `duration` + `easing`, **mai `springify()`**) e per il resto solo opacità: la versione con molle e cascate è stata bocciata a schermo. Dettagli e curve in `features/guide-annullate.md`.
- Backend: `../reglo/docs/features/license-paths.md`.

### Student Phase
- → **Quiz Teoria**: tab visibile solo in TEORIA + `hasQuizAccess`; CTA della home TEORIA portano direttamente al quiz.
- → **Booking Flow**: tab Agenda nascosta in AWAITING e TEORIA + booking server-side bloccato (messaggi distinti per AWAITING vs TEORIA).
- → **Tab Layout**:
  - AWAITING → solo `home` (niente settings, notes, quiz)
  - TEORIA → `home` + `quiz` (se `hasQuizAccess`) + eventualmente `notes`
  - PRATICA → `home` + `notes` + `settings`. Scambi **non** è una tab: si apre da `home/swaps` via CTA "Scambi" (se `swapEnabled`).
  - PATENTATO → solo `home`
- → **Notifications**: due `kinds` (`theory_exam_countdown`, `theory_quiz_inactivity`) inbox-only.
- → **Home routing**: `RoleHomeScreen` usa la fase per scegliere fra `AllievoAwaitingScreen`, `AllievoTheoryHomeScreen`, `AllievoHomeScreen`, `AllievoLicensedScreen`.
- → **Backend**: `GET /api/autoscuole/me` (arricchita di `phasesEnabled`, `hasQuizAccess`, `autoAssignQuizOnSignup`), `POST /api/mobile/auth/student-register` (decide fase + seat in transaction), `updateStudentPhase` + `grantQuizSeat` + `setAutoAssignQuizOnSignup` (tutte web/owner only).

### Locations
- → **Booking Flow / Instructor Manage**: i luoghi vengono scelti quando si prenota/crea una guida (`LocationPickerSheet`, `InlineLocationPicker`, `IstruttoreHomeScreen` chiamano anch'essi `getLocations`, ma non condividono ancora `useLocations`).
- → **Settings**: raggiungibile da "Altro" (istruttore/owner).
- → **Backend**: `getLocations`/`createLocation`/`updateLocation`/`deleteLocation`. Google Places via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Form migrato da `BottomSheet` custom (`LocationFormSheet`, eliminato) a route formSheet `more/location-form` (store-driven).

### Instructor Hours
- → **Settings / Cluster**: la finestra "orario di lavoro" che definisce le ore *fuori orario* arriva dalle impostazioni istruttore/azienda.
- → **Backend**: `GET /api/autoscuole/instructor-hours` (settimanale + mensile). Hook cache-first `useInstructorHours` per settimana.

### Vehicles
- **Owner + Instructor condividono `VehiclesScreen`** (impl unica): `OwnerVehiclesScreen`/`InstructorVehiclesScreen` sono wrapper sottili; il route `more/vehicles` smista per ruolo. Lista flat (header large-title blur collassabile, righe icona+nome+targa, tap → form, `•••` → ActionSheet attiva/disattiva).
- Form migrato da `BottomSheet` + `TimePickerDrawer` a route formSheet `more/vehicle-form` (store `vehicleFormStore`, seed-and-callback `onChanged`) + route `more/time-picker` (`timePickerStore`).
- → **Backend**: `getVehicles`/`createVehicle`/`updateVehicle` (name/plate/status) e `deleteVehicle` (= soft-delete, status inattivo). Disponibilità via `get/create/deleteAvailabilitySlots` (`ownerType: 'vehicle'`), orizzonte `settings.availabilityWeeks`.
- → **Availability Editor / Booking**: la disponibilità del veicolo concorre agli slot prenotabili; cambia gli slot mostrati in prenotazione.
- **Veicolo fisso per istruttore (1:1, 2026-06-09)**: tutto in `more/vehicle-form` (sezione Veicoli, NON nei cluster). Titolare → picker "Istruttore assegnato" (`isOwner`, lista da `getInstructors`); istruttore → toggle "Assegna a me" (`session.instructorId`; bloccato se il veicolo è di un altro). Toggle `followsInstructorAvailability` nel form. BE riassegna automaticamente (rilascia il veicolo precedente dell'istruttore). → **Quick-book** (`IstruttoreHomeScreen`/`bookingSheetStore`): `defaultVehicleId` precompilato col veicolo fisso, modificabile. → **Backend** `updateVehicle({assignedInstructorId, followsInstructorAvailability})`.
- **Categorie patente (B/BE/AMQ/B1/C/CE/D/DE/AM/A1/A2/A + cambio, 2026-06-09, 2° mattone; quadricicli dal 03/10/2026 REG-588)**: veicolo = una categoria + un cambio (picker in `more/vehicle-form`, costanti `src/utils/license.ts`, badge in `VehiclesScreen`). L'idoneità dell'istruttore è **derivata dal veicolo** (nessun campo istruttore). Il percorso dell'allievo (`CompanyMember.licenseCategory/transmission`) lo imposta il **titolare da web** (no edit allievo su mobile); arriva in `StudentPhasePayload` come info. Matching BE **gated su `vehiclesEnabled`**. → **Tipi** `AutoscuolaVehicle`/`Create|UpdateVehicleInput`/`StudentPhasePayload`. → **Quick-book** invariato.

### Password Reset
- **`PasswordResetScreen`** (sheet iOS / inline Android): 3 step email→codice→password, riusa `AuthField` + `ToastNotice` + pattern code-input di `SignupScreen`.
- → **Session & Auth**: usa `SessionContext.applyAuthPayload` per l'auto-login; se cambia la shape di `AuthPayload` aggiorna login + reset insieme.
- → **LoginScreen**: `onForgot` apre la route per piattaforma (`password-reset-sheet` / `password-reset`); entrambe in `allowedAuthLeaves` (`app/_layout.tsx`).
- → **Backend**: 3 route `POST /api/mobile/auth/password-reset/*`. OTA-safe (nessun modulo nativo nuovo).

### Phone Gate
- **`PhoneGateScreen`** — gate bloccante per allievi senza `user.phone`; early-return in `(tabs)/_layout.tsx` PRIMA del render di `<Tabs>` (sostituisce tutto, incluso `NotificationOverlay`).
- → **Session & Auth**: legge `user`/`status` da `SessionContext`, salva con `regloApi.updateProfile` poi `refreshMe()`; "Esci" usa `signOut`.
- → **Backend**: `PATCH /api/mobile/profile` (esistente; `name` obbligatorio min 3 — si rimanda quello corrente).
- ⚠️ Chi tocca `(tabs)/_layout.tsx` deve preservare l'early-return del gate prima del `return <QuizProvider>`.

### License Path Gate (REG-410)
- **`LicensePathGateScreen`** — gate bloccante per allievi self-registered senza percorso patente; early-return in `(tabs)/_layout.tsx` **dopo** il phone gate, quando `status==='ready' && isStudent && needsLicensePath`.
- → **Student Phase**: `needsLicensePath` viaggia su `StudentPhasePayload` (`useStudentPhase`). Ortogonale alla fase: precede la home per-fase. Chi cambia `StudentPhasePayload`/`useStudentPhase`/`_layout.tsx` deve preservarlo.
- → **Session & Auth**: legge `activeCompanyId`, salva con `regloApi.setLicensePath` poi `invalidateQueries(studentPhase)` + `refreshMe()`; "Esci" usa `signOut`.
- → **Phone Gate**: stesso pattern/ordine (prima phone, poi license). Vedi [features/license-path-gate.md](features/license-path-gate.md).
- → **Backend**: `GET /api/autoscuole/me` (`needsLicensePath`), `PATCH /api/autoscuole/me/license-path`, `student-register` (`selfRegistered`, niente seed licenza).
- ⚠️ Cambio prodotto (REG-410): il "Tipo di cambio" è **obbligatorio** (nessun default, CTA bloccata finché categoria+cambio non scelti).

## Cross-Repo Impact

When `../reglo/` backend changes:

| Backend change | Mobile files to update |
|---------------|----------------------|
| New/changed API response field | `src/types/regloApi.ts` + all consuming screens (grep for type) |
| New notification kind | `notifications.ts` types → `NotificationOverlay` handler → `NotificationInboxScreen` rendering |
| Changed endpoint URL/params | `src/services/regloApi.ts` function |
| New instructor setting | `InstructorClusterSettings` type + 9 consuming screens |
| Changed appointment status values | Status-dependent rendering in 14 files |
| New lesson type | `src/utils/lessonTypes.ts` + screens showing lesson type labels |
| Student phase model change | `src/types/regloApi.ts` (StudentPhasePayload), `useMyPhase`, `useStudentPhase`, `_layout.tsx`, `RoleHomeScreen` |
| New theory reminder push kind | `src/types/notifications.ts` + `NotificationInboxScreen` (title + subtitle; niente icona per tipo dal 28/10) |

### Group Lessons MOTO (kind="moto", 2026-06-25)
- → **Backend**: a moto group has a moto **fleet** + one shared **follow car**; each participant gets an auto-assigned moto (mixed categories OK). Types `GroupLesson.kind/followVehicle*/fleet`, `GroupLessonParticipant.vehicleName/licenseCategory`, `CreateGroupLessonInput.kind/vehicleIds/followVehicleId` (`src/types/regloApi.ts`). Service `createGroupLesson`/`updateGroupLesson` forward the new fields.
- → **CreateGroupLessonScreen**: Standard/Moto segmented toggle; moto = multi-picker fleet (`optionsPickerStore` multi) + follow-car picker; capacity = fleet size; follow car required when `settings.followCarRules` enables a fleet category. Management of participants stays on web.

### Student moto experience (UI moto-aware, 2026-06-26)
- → **Shared chooser** `src/utils/lessonArt.ts` (`lessonArtSource`/`heroArtSource`) + `src/utils/license.ts` (`isMotoLicenseCategory`). Used by: `AllievoHomeScreen` (hero/mini/empty/exam), `home/all-lessons`. Per-guide signal = `appointment.vehicle?.licenseCategory`; fallback = `useStudentPhase().licenseCategory`. Asset `assets/icons3d-ai/auto.png` / `moto.png` (REG-639; le Fluent `fluent-car`/`fluent-motorcycle`/`fluent-racing` sono state eliminate).
- → **Tab Layout**: `_layout.tsx` computes `isStudentMoto` → `GlassTabBar.isStudentMoto` → Home icon `bicycle-outline` (Teoria override wins).
- → **Group Lessons (student view)**: `group-lesson-detail` shows self moto + follow car + "Guida di gruppo moto"; `GroupLessonInvitesScreen` shows "Ti verrà assegnata una moto" (needs backend `getGroupLessonInvites` → `kind`; type `GroupLessonInvite.kind`).
- Category `B` (auto) students: **unchanged** (default car branch everywhere).

### Guide obbligatorie (contatore x/6)
- Regola in `src/utils/mandatoryLessons.ts` (`REQUIRED_LESSONS`, `isMandatoryLessonDuration`): contano **solo le guide da esattamente 60 minuti**, `endsAt` nullo escluso. Usata da `StudentNotesDetailScreen` (solo per la statistica «guide fatte») e `InstructorNotesScreen` (riga "x di 6 guide" della lista allievi, solo quando non c'è prossima guida né da pagare).
- **Giro «memorabile» (28/10/2026, scelta di Tiziano)**: il blocco «Guide obbligatorie» (barra, contatore «6 di 6») è stato TOLTO dal dettaglio allievo e l'anello «4/6» dal foglio «Gestisci guida» (`home/manage-lesson`). `studentProgress` resta nel `manageLessonStore` ma il foglio non lo disegna più.
- **Gemella** di `reglo/lib/autoscuole/mandatory-lessons.ts`, che alimenta il `summary` del dettaglio allievo web e il flag `mandatoryLesson` dei colori agenda: le due copie vanno cambiate insieme.
- Prima del 2026-09-18 entrambe le schermate contavano tutte le guide completate/checked_in, comprese quelle da 30 minuti.

## Notifiche esame (REG-604)
- ← **Backend `exam-notifications.ts`**: i testi li decide il backend, l'app li mostra. `data.isExam` / `data.timeSet` nel payload di `appointment_rescheduled`, `appointment_cancelled`, `appointment_location_changed` e `exam_scheduled` servono all'inbox per non scrivere «00:00» su un esame senza orario
- → **`src/utils/examTime.ts`**: `examTimeIsTbd()` è il marcatore unico lato app (`!endsAt`). **Non** `isExamPlaceholder` in `weeklyAgenda.ts`, che è l'esame senza *allievi*
- → **Schermi allievo**: `AllievoHomeScreen`, `exam-detail`, `StudentMyNotesScreen`, `StudentNotesDetailScreen`, `NotificationInboxScreen`


> 28/10/2026 (REG-638): l'agenda istruttore/titolare ha solo la griglia (`WeeklyAgendaView`). `WeeklyOverview`, `WeeklyLiveCard`, `DayItinerary`, `home/day-detail` e `dayDetailStore` sono stati eliminati: dove sopra o nei feature doc compaiono, sono storici.
>
> 28/10/2026 notte (REG-639): era tornata una vista **Giorno** a lista (`AgendaDayView` + `AgendaDayStrip`), bocciata ed eliminata il 29/10: l'Agenda è **solo la Settimana** (griglia clay, blocchi a fondo pastello pieno). Vedi [features/agenda-istruttore.md](features/agenda-istruttore.md). Le icone Fluent (`assets/icons/fluent-*.png`) sono state eliminate: dove i doc le citano, sono storiche.
