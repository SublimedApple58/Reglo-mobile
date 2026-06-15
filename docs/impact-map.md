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
| `AutoscuolaAppointmentWithRelations` | AllievoHome, IstruttoreHome, TitolareHome, InstructorManage, NotificationOverlay, RescheduleAppointmentSheet, notes screens (14) |
| `InstructorClusterSettings` | Settings, InstructorAvailability, IstruttoreHome, InstructorNotes, CreateExam, ClusterSettings, InstructorManage, PublicationModeEditor (9) |
| `AutoscuolaStudent` | NotificationOverlay, CreateExam, notes screens (7) |
| `NotificationItem` | NotificationOverlay, NotificationInboxScreen, notificationStore (3) |

## Feature Adjacency

### Booking Flow
- → **Notifications**: booking success can trigger proposal/confirmation notifications
- → **Settings**: booking governance (limits, cutoff, actors) configured in settings
- → **Backend**: `createBookingRequest()`, `getAvailableSlots()`, `getBookingOptions()`

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

### Exam Creation
- → **Booking Flow**: exam is a special appointment type
- → **Settings**: reads cluster config for student grouping
- → **Backend**: `createExam()`, `getStudents()`, `getInstructorSettings()`

### Group Lessons (manage)
- → **IstruttoreHome**: `openGroupLessonManage(groupLessonId)` opens `home/manage-group-lesson` (page sheet) from both the day-detail card and the hour-grid card (`openLessonDrawer` short-circuit on `type==='group_lesson'`). Refreshes via `loadData()` on `onChanged`.
- → **Pickers (reused)**: `manage-lesson-instructor` (instructorPickerStore), `select-options` (optionsPickerStore — veicolo / durata / aggiungi-allievo), `select-date` (dayPickerStore), `time-picker` (timePickerStore). Changing any of these shared picker stores/routes affects this modal too.
- → **Backend**: `getGroupLesson` (GET), `updateGroupLesson` (PATCH — applies to all participants), `cancelGroupLesson`, `add/removeGroupLessonParticipant`, `inviteToGroupLesson`, `getEligibleGroupLessonInvitees`, `getInstructors`, `getVehicles`.
- → **Vehicles**: vehicle picker subtitle uses `plate` + `licenseCategory`; gated on `settings.vehiclesEnabled`.

### Instructor Manage
- → **Availability Editor**: overlaps in override management (MiniCalendar, RangesEditor)
- → **Notifications**: appointment changes trigger push
- → **Notes**: appointment editing includes notes/ratings
- → **Backend**: 15+ API functions (appointments, availability, settings)

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
| New theory reminder push kind | `src/types/notifications.ts` + `NotificationInboxScreen` (icon + title + subtitle) |
