# Component & Screen Impact Map — Reglo Mobile

When modifying a feature, read its connected features to verify nothing breaks.

## Shared Component → Screens

| Component | Used by screens | Notes |
|-----------|----------------|-------|
| `BottomSheet` | CreateExam, IstruttoreHome, InstructorManage, LocationPickerSheet, NotificationOverlay, OwnerInstructor, RescheduleAppointmentSheet, TitolareHome (8) | iOS + Android separate implementations. ClusterSettings + Vehicles migrated to formSheet routes. |
| `TimePickerDrawer` | CreateExam, InstructorManage, OwnerInstructor, PublicationModeEditor, RescheduleAppointmentSheet, Settings (6) | Depends on BottomSheet. ClusterSettings + Vehicles now use the formSheet `time-picker` route (timePickerStore). |
| `CalendarDrawer` | AllievoHome, CreateExam, IstruttoreHome (3) | Depends on MiniCalendar + BottomSheet. (TitolareHome ora è un wrapper di IstruttoreHome.) |
| `RangesEditor` | InstructorManage, OwnerInstructor, PublicationModeEditor, DefaultAvailabilityEditor, role/availability-exception (5) | Time range format changes break all availability UIs. Navy clock circle (no pink). |
| `SelectableChip` | CalendarNavigator, ClusterSettings, InstructorManage, Settings (4) | |
| `WeeklyAgendaView` | — (0, orfano) | Hour-grid week view. **Non più usato**: IstruttoreHome e TitolareHome usano `WeeklyOverview`. Componente lasciato in repo ma senza consumer. |
| `WeeklyOverview` | IstruttoreHome (anche TitolareHome via `ownerMode`) (1) | "Control in words" week view (preview 008): density strip + per-day textual summary + tap-to-expand inline `DayItinerary`. Uses `computeDayPlan` (`src/utils/weeklyAgenda.ts`) + `BookableBand` (quick-book, nascosto in `ownerMode`). |
| `BookingCelebration` | AllievoHome, NotificationOverlay, SwapOffers (3) | 2 variants: 'booking' and 'swap' |
| `StarRating` | IstruttoreHome (input), StudentMyNotes (display), StudentNotesDetail (display) (3) | |
| `RescheduleAppointmentSheet` | IstruttoreHome (1) | Complex: BottomSheet + CalendarDrawer + TimePickerDrawer |
| `BookingForm` | `home/new-booking`, `home/quick-book` (2) | Form completo prenotazione. Legge `bookingSheetStore`. Prop `embedded`. Modificarlo cambia ENTRAMBE le route. |
| `BlockForm` | `home/block-slot`, `home/quick-book` (2) | Form completo blocca slot. Legge `blockSheetStore`. Prop `embedded`. Modificarlo cambia ENTRAMBE le route. |
| `MiniCalendar` | InstructorManage, OwnerInstructor, role/availability-exception + used by CalendarDrawer (4) | Navy selected/today/dot (no yellow/pink). |

## API Type → Screens

| Type | Used by (screen count) |
|------|----------------------|
| `AutoscuolaAppointmentWithRelations` | AllievoHome, IstruttoreHome, TitolareHome, InstructorManage, NotificationOverlay, RescheduleAppointmentSheet, notes screens, LessonsOverview (15) — since 2026-06-24 carries `followVehicle` (auto al seguito); a moto lesson reserves **2 vehicles** (moto + follow car). Since 2026-07-20 carries `cancelledAt/penaltyAmount/penaltyCutoffAt/lateCancellationAction` (dal ramo backend `light`), consumati da `LessonsOverview` segmento "Annullate". Since REG-399 carries `motoLessonType` (`'birilli'\|'strada'\|null`) — guide **individuali**: selettore in creazione (`BookingForm`), riga read-only `manage-lesson`, chip `StudentNotesDetailScreen`. Since REG-406 carries `groupLessonMotoType` (annotazione bootstrap agenda) per le guide di **gruppo moto** — selettore in creazione (`CreateGroupLessonScreen`), riga read-only `manage-group-lesson`, badge chip `DayItinerary`; vedi [features/moto-lesson-type.md](features/moto-lesson-type.md). Display it wherever `vehicle.name` is shown. |
| `InstructorClusterSettings` | Settings, InstructorAvailability, IstruttoreHome, InstructorNotes, CreateExam, ClusterSettings, InstructorManage, PublicationModeEditor (9) |
| `AutoscuolaSettings.agendaColor*` (`agendaColorCriterion`/`Overrides`/`Exceptions`) | DayItinerary, IstruttoreHome (timeline `itinCard`) via `src/utils/agendaColors.ts` — colore blocchi guida in agenda. Già nel payload di `GET /api/autoscuole/settings`. Vedi [features/agenda-block-colors.md](features/agenda-block-colors.md). |
| `AutoscuolaStudent` | NotificationOverlay, CreateExam, notes screens (7) |
| `AutoscuolaAppointment.manualPaymentStatus` / `creditApplied` / `paymentRequired` | `StudentPaymentsScreen`, `StudentNotesDetailScreen` (conteggio "da pagare") via `src/utils/lessonPayments.ts` (REG-450). **Solo ramo full** di `getAppointments`. Vedi [features/lesson-payments.md](features/lesson-payments.md). |
| `AutoscuolaLocation.licenseCategories` | `BookingForm` via `src/utils/locationForLicense.ts` — precompilazione del campo Luogo (REG-409). Campo **opzionale**: assente sui backend pre-REG-409 → lista vuota, si ricade sulla sede. Scritto SOLO dal web. Vedi [features/locations.md](features/locations.md). |
| `NotificationItem` | NotificationOverlay, NotificationInboxScreen, notificationStore (3) |

## Feature Adjacency

### Booking Flow
- → **Notifications**: booking success can trigger proposal/confirmation notifications
- → **Settings**: booking governance (limits, cutoff, actors) configured in settings
- → **Backend**: `createBookingRequest()`, `getAvailableSlots()`, `getBookingOptions()`

### Guide annullate (vista allievo)
- **Componente condiviso** `LessonsOverview` (segmenti Programmate | Annullate) usato da 2 punti d'accesso: `home/all-lessons` (sheet seedato, card tappabili via `allLessonsStore`) e `settings/le-tue-guide` (Profilo allievo, autonomo, non tappabili). Cambiare `LessonsOverview` impatta ENTRAMBE le route.
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
- → **Backend**: recovery endpoint, push token management
- → **Types**: `NotificationItem` union, `PersistedNotification`, notification store

### Settings
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
- → **Salvataggio**: `ManageLessonDetailsPayload.evaluations` attraversa i DUE opener del foglio (`IstruttoreHomeScreen`, `StudentNotesDetailScreen`): se ne aggiungi un terzo, ricordati di inoltrarlo o i voti si perdono in silenzio
- → **Backend**: contratto `GET /api/autoscuole/appointments/:id/evaluation` + campo `evaluations` nella PATCH dei dettagli (reglo `docs/features/evaluation-sheet.md`)
- → **Altro (MoreScreen)**: la riga "Pagellino" sta nella sezione Gestione, visibile a titolari E istruttori — chi cambia quel gate deve cambiare anche `saveEvaluationSheet` lato reglo, dove sta il permesso vero
- → **Configurazione**: `GET`/`PUT /api/autoscuole/evaluation-sheet` è lo stesso contratto del pane Impostazioni web; il salvataggio SOSTITUISCE l'elenco e ARCHIVIA le voci tolte — le costanti in `src/utils/evaluationSheet.ts` (scale, max 40, 60 caratteri, modello base) sono gemelle di quelle in `reglo/lib/autoscuole/evaluation-sheet.ts` e vanno cambiate insieme
- → **Form sheet nativi**: `evaluation-item` usa `HUG_SHEET` e le misure §13.2.1 del design system (testata 26/26 perché ha titolo+sottotitolo+bottoncini)

### Exam Creation
- → **Booking Flow**: exam is a special appointment type
- → **Settings**: reads cluster config for student grouping
- → **Backend**: `createExam()`, `getStudents()`, `getInstructorSettings()`
- → **Pronto per l'esame**: il picker (`select-exam-students`) differenzia i pronti (badge + anello + ordine); flag non vincolante

### Pronto per l'esame (exam-ready)
- → **Notes (istruttore)**: toggle in `StudentNotesDetailScreen` (solo PRATICA), `setStudentExamReady`
- → **Exam Creation**: badge "Pronto" nel picker + ordine pronti-in-cima
- → **Backend**: `PATCH /api/autoscuole/students/:id/exam-ready`; `AutoscuolaStudent.examReady`, `getInstructorSettings().students[].examReady`

### Group Lessons (manage)
- → **IstruttoreHome**: `openGroupLessonManage(groupLessonId)` opens `home/manage-group-lesson` (page sheet) from both the day-detail card and the hour-grid card (`openLessonDrawer` short-circuit on `type==='group_lesson'`). Refreshes via `loadData()` on `onChanged`.
- → **Pickers (reused)**: `manage-lesson-instructor` (instructorPickerStore), `select-options` (optionsPickerStore — veicolo / durata / aggiungi-allievo), `select-date` (dayPickerStore), `time-picker` (timePickerStore). Changing any of these shared picker stores/routes affects this modal too.
- → **Backend**: `getGroupLesson` (GET, now returns `participants[].notes`), `updateGroupLesson` (PATCH — applies to all participants), `cancelGroupLesson`, `add/removeGroupLessonParticipant`, `inviteToGroupLesson`, `getEligibleGroupLessonInvitees`, `getInstructors`, `getVehicles`.
- → **Notes (per-allievo, 2026-06-16)**: the roster (`manage-group-lesson-participants`) writes a per-student note via `updateAppointmentDetails(appointmentId, {notes})` on the seat appointment. The student reads it in **StudentMyNotes** (teal `group_lesson` card) — same `getAppointments` path, no new endpoint.
- → **Vehicles**: vehicle picker subtitle uses `plate` + `licenseCategory`; gated on `settings.vehiclesEnabled`.

### Instructor Manage
- → **Availability Editor**: overlaps in override management (MiniCalendar, RangesEditor)
- → **Notifications**: appointment changes trigger push
- → **Notes**: appointment editing includes notes/ratings
- → **Backend**: 15+ API functions (appointments, availability, settings)

### Colori blocchi agenda (criterio Aspetto)
- → **Instructor Manage / agenda**: la tinta si applica alle card guida in `DayItinerary` (day-detail + espansione `WeeklyOverview`) e alla timeline giornaliera `itinCard` di `IstruttoreHomeScreen`. Esami/gruppi/blocchi e stati annullata/assente esclusi.
- → **Settings**: legge `agendaColor*` da `AutoscuolaSettings` (`GET /api/autoscuole/settings`). Lettura ovunque; **scrittura staff (istruttori + titolari)** dal pannello `AppearanceSettingsScreen` (`Altro → Aspetto agenda`, gate `isInstructor||isOwner`) via endpoint **scoped** `PATCH /api/autoscuole/agenda-colors` → `regloApi.updateAgendaColorSettings` + `setQueryData` sulla cache `useAutoscuolaSettings` (le agende rileggono). Il picker colori è `more/color-picker` (`colorPickerStore`). Backend scoped `updateAgendaColorSettings` (`canManageAgendaColors`) scrive solo i 3 campi → permesso allargato in sicurezza.
- → **Student moto experience / Vehicles**: le eccezioni usano `student.licenseCategory`/`transmission`/`examReady` + `isMotoLicenseCategory`. Se cambiano quei campi o gli hex/soglie web (`reglo/lib/autoscuole/agenda-color-criterion.ts`), aggiornare `src/utils/agendaColors.ts` in parallelo (palette duplicata client-side).
- → **Backend**: nessuna modifica (dati già esposti).

### Lezione teorica (agenda)
- **È un** `InstructorBlock` con `reason:"theory_lesson"` (endpoint `createInstructorBlock` riusato; nessun tipo/route nuovi)
- → **Quick-book**: condivide `BlockForm`/`blockSheetStore` (`kind`); NON nel segmentato quick-book (solo menu ＋)
- → **Instructor Manage / agenda**: rendering in `IstruttoreHomeScreen` (giornaliera + dot), `DayItinerary`, `WeeklyAgendaView` (`weeklyAgenda.BLOCK_PRESENTATION.theory`) — card piena in tinta, non muted
- → **Backend**: nessuna modifica; passa dai check di disponibilità esistenti

### Pagamenti guide (REG-450)
- → **Dettaglio allievo (`StudentNotesDetailScreen`)**: ci vive il blocco "Pagamenti" (visibile SOLO in modalità manuale) e da lì si apre `student-payments`. Chi tocca `loadData` deve continuare a riempire **`allAppointments`** (storico GREZZO, annullate comprese) e **`paymentSettings`**: la schermata pagamenti non fa fetch propri, legge solo il seed dello store. Se qualcuno rifiltra le annullate a monte, i filtri "Annullate" e le penali tardive spariscono in silenzio.
- → **Due stack**: `student-payments` è registrata in `home/_layout` E `notes/_layout` (la scheda allievo si apre da entrambi). Aggiungerne un terzo significa registrarla anche lì.
- **Regola gemella** `src/utils/lessonPayments.ts` ↔ `reglo/lib/autoscuole/unpaid-auto-block.ts` (`isCompanyManualMode`, `isLessonUnpaid`): stessa definizione di "guida da pagare" che alimenta badge web, contatore lista allievi e **blocco automatico prenotazioni per debito**. Vanno cambiate INSIEME.
- → **Guide annullate**: una annullata con `lateCancellationAction === 'charged'` e `manualPaymentStatus === 'unpaid'` è una guida **da pagare**. Se cambiano i valori di `lateCancellationAction`, aggiornare entrambe le copie.
- → **API Layer**: `manualPaymentStatus` arriva SOLO dal ramo **full** di `getAppointments` (il ramo `light` non lo seleziona) — una vista seedata `light` mostrerebbe tutto come non pagato. `lessonCreditsRequired` arriva da `GET /api/autoscuole/settings`.
- → **Session**: l'azione si disegna se `autoscuolaRole` è staff (OWNER / INSTRUCTOR_OWNER / INSTRUCTOR) — `canManageLessonPayments`. **Nessuna restrizione per guida**: dal 18/09/2026 anche l'istruttore segna le guide dei colleghi (l'incasso è amministrativo, non didattico). Se cambi questa regola, cambia anche la gemella BE `reglo/lib/autoscuole/lesson-payments.ts` + il suo test, o il pulsante compare e poi fallisce.
- → **Backend (`reglo`)**: `PATCH /api/autoscuole/appointments/:id/manual-payment` → azione `setManualPaymentStatus`, permesso scoped `canManageLessonPayments` (`lib/autoscuole/lesson-payments.ts`, unit-testato). I **crediti** restano owner/admin (`canManageStudentCredits`): "Copri con credito" del web NON è stato portato su mobile.

### Notes
- → **Instructor Manage**: notes are part of appointment detail editing
- → **Backend**: `getLatestStudentAppointmentNote()`, `updateAppointmentDetails()`

### Quiz Teoria
- → **Settings**: legge `quizSeats` / `phasesEnabled` / `autoAssignQuizOnSignup` via `/api/autoscuole/me`. Il legacy `quizEnabled` resta come fallback difensivo per backend più vecchi.
- → **Student Phase**: la tab `quiz` è visibile **solo** se `studentPhase === TEORIA && hasQuizAccess === true`. In AWAITING / PRATICA / PATENTATO la tab è nascosta.
- → **Tab Layout**: conditional quiz tab in `_layout.tsx`, con `hasQuizAccess` come segnale primario.
- → **Backend**: 7 API functions (chapters, sessions, answers, stats)
- → Self-contained: QuizContext holds session state, 3 screens

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
- → **Luogo per tipo di patente (REG-409)**: `src/utils/locationForLicense.ts` è **gemello** di `../reglo/lib/autoscuole/location-for-license.ts` — se cambia la precedenza (allievo → patente → sede) o la shape di `GET /api/autoscuole/locations`, **le due copie vanno cambiate insieme**, come `mandatoryLessons.ts` e `agendaColors.ts`. Consumato da `BookingForm` (ricalcolo al cambio allievo/veicolo, `locationTouchedRef` per la scelta manuale).
- → **Booking Flow (allievo)**: la prenotazione self-service **non ha** un campo Luogo — lo assegna il backend (`createBookingRequest`/`respondWaitlistOffer`), che dal 2026-09-19 applica la stessa precedenza invece della sede fissa. Nessun codice mobile coinvolto, ma il luogo mostrato nel dettaglio guida ora può non essere la sede.
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
- **Categorie patente (B/AM/A1/A2/A + cambio, 2026-06-09, 2° mattone)**: veicolo = una categoria + un cambio (picker in `more/vehicle-form`, costanti `src/utils/license.ts`, badge in `VehiclesScreen`). L'idoneità dell'istruttore è **derivata dal veicolo** (nessun campo istruttore). Il percorso dell'allievo (`CompanyMember.licenseCategory/transmission`) lo imposta il **titolare da web** (no edit allievo su mobile); arriva in `StudentPhasePayload` come info. Matching BE **gated su `vehiclesEnabled`**. → **Tipi** `AutoscuolaVehicle`/`Create|UpdateVehicleInput`/`StudentPhasePayload`. → **Quick-book** invariato.

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
| Cambio precedenza/shape del Luogo precompilato (REG-409) | `src/utils/locationForLicense.ts` (gemello di `reglo/lib/autoscuole/location-for-license.ts`) + `BookingForm` |
| Student phase model change | `src/types/regloApi.ts` (StudentPhasePayload), `useMyPhase`, `useStudentPhase`, `_layout.tsx`, `RoleHomeScreen` |
| New theory reminder push kind | `src/types/notifications.ts` + `NotificationInboxScreen` (icon + title + subtitle) |

### Group Lessons MOTO (kind="moto", 2026-06-25)
- → **Backend**: a moto group has a moto **fleet** + one shared **follow car**; each participant gets an auto-assigned moto (mixed categories OK). Types `GroupLesson.kind/followVehicle*/fleet`, `GroupLessonParticipant.vehicleName/licenseCategory`, `CreateGroupLessonInput.kind/vehicleIds/followVehicleId` (`src/types/regloApi.ts`). Service `createGroupLesson`/`updateGroupLesson` forward the new fields.
- → **CreateGroupLessonScreen**: Standard/Moto segmented toggle; moto = multi-picker fleet (`optionsPickerStore` multi) + follow-car picker; capacity = fleet size; follow car required when `settings.followCarRules` enables a fleet category. Management of participants stays on web.

### Student moto experience (UI moto-aware, 2026-06-26)
- → **Shared chooser** `src/utils/lessonArt.ts` (`lessonArtSource`/`heroArtSource`) + `src/utils/license.ts` (`isMotoLicenseCategory`). Used by: `AllievoHomeScreen` (hero/mini/empty/exam), `home/all-lessons`. Per-guide signal = `appointment.vehicle?.licenseCategory`; fallback = `useStudentPhase().licenseCategory`. Asset `assets/icons/fluent-motorcycle.png`.
- → **Tab Layout**: `_layout.tsx` computes `isStudentMoto` → `GlassTabBar.isStudentMoto` → Home icon `bicycle-outline` (Teoria override wins).
- → **Group Lessons (student view)**: `group-lesson-detail` shows self moto + follow car + "Guida di gruppo moto"; `GroupLessonInvitesScreen` shows "Ti verrà assegnata una moto" (needs backend `getGroupLessonInvites` → `kind`; type `GroupLessonInvite.kind`).
- Category `B` (auto) students: **unchanged** (default car branch everywhere).

### Guide obbligatorie (contatore x/6)
- Regola in `src/utils/mandatoryLessons.ts` (`REQUIRED_LESSONS`, `isMandatoryLessonDuration`): contano **solo le guide da esattamente 60 minuti**, `endsAt` nullo escluso. Usata da `StudentNotesDetailScreen` (obbligo dell'allievo) e `InstructorNotesScreen` (riga "obbligo x/6" della lista allievi).
- **Gemella** di `reglo/lib/autoscuole/mandatory-lessons.ts`, che alimenta il `summary` del dettaglio allievo web e il flag `mandatoryLesson` dei colori agenda: le due copie vanno cambiate insieme.
- Prima del 2026-09-18 entrambe le schermate contavano tutte le guide completate/checked_in, comprese quelle da 30 minuti.
