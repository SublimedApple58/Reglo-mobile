# Component & Screen Impact Map — Reglo Mobile

When modifying a feature, read its connected features to verify nothing breaks.

## Shared Component → Screens

| Component | Used by screens | Notes |
|-----------|----------------|-------|
| `BottomSheet` | AllievoPayments, CreateExam, IstruttoreHome, InstructorManage, InstructorVehicles, LocationPickerSheet, NotificationOverlay, OwnerInstructor, OwnerVehicles, RescheduleAppointmentSheet, TitolareHome (11) | iOS + Android separate implementations. ClusterSettings migrated to a page-sheet route (notes/group-students). |
| `TimePickerDrawer` | CreateExam, InstructorManage, InstructorVehicles, OwnerInstructor, OwnerVehicles, PublicationModeEditor, RescheduleAppointmentSheet, Settings (8) | Depends on BottomSheet. ClusterSettings now uses the formSheet `time-picker` route (timePickerStore). |
| `CalendarDrawer` | AllievoHome, CreateExam, IstruttoreHome, TitolareHome (4) | Depends on MiniCalendar + BottomSheet |
| `RangesEditor` | InstructorManage, OwnerInstructor, PublicationModeEditor, DefaultAvailabilityEditor, role/availability-exception (5) | Time range format changes break all availability UIs. Navy clock circle (no pink). |
| `SelectableChip` | CalendarNavigator, ClusterSettings, InstructorManage, Settings (4) | |
| `WeeklyAgendaView` | IstruttoreHome, TitolareHome (2) | Shared between instructor and owner |
| `BookingCelebration` | AllievoHome, NotificationOverlay, SwapOffers (3) | 2 variants: 'booking' and 'swap' |
| `StarRating` | IstruttoreHome (input), StudentMyNotes (display), StudentNotesDetail (display) (3) | |
| `RescheduleAppointmentSheet` | IstruttoreHome (1) | Complex: BottomSheet + CalendarDrawer + TimePickerDrawer |
| `MiniCalendar` | InstructorManage, OwnerInstructor, role/availability-exception + used by CalendarDrawer (4) | Navy selected/today/dot (no yellow/pink). |

## API Type → Screens

| Type | Used by (screen count) |
|------|----------------------|
| `AutoscuolaAppointmentWithRelations` | AllievoHome, IstruttoreHome, TitolareHome, InstructorManage, NotificationOverlay, RescheduleAppointmentSheet, notes screens (14) |
| `InstructorClusterSettings` | Settings, InstructorAvailability, IstruttoreHome, InstructorNotes, CreateExam, ClusterSettings, InstructorManage, PublicationModeEditor (9) |
| `AutoscuolaStudent` | NotificationOverlay, CreateExam, notes screens (7) |
| `MobileStudentPaymentProfile` | Settings, AllievoPayments (2) |
| `NotificationItem` | NotificationOverlay, NotificationInboxScreen, notificationStore (3) |

## Feature Adjacency

### Booking Flow
- → **Notifications**: booking success can trigger proposal/confirmation notifications
- → **Payments**: booking may require payment snapshot
- → **Settings**: booking governance (limits, cutoff, actors) configured in settings
- → **Backend**: `createBookingRequest()`, `getAvailableSlots()`, `getBookingOptions()`

### Availability Editor
- → **Booking Flow**: published availability determines bookable slots for students
- → **Settings**: `availabilityMode` toggle (default vs publication) lives in Settings (chosen there, NOT in the Disponibilità screen)
- → **Backend**: `setDailyAvailabilityOverride()`, `setRecurringAvailabilityOverride()`, `deleteDailyAvailabilityOverride()`, `createAvailabilitySlots()`, `publishWeek()`, `unpublishWeek()`
- **Live tree:** `app/(tabs)/role/` stack → `InstructorAvailabilityScreen` (shell, collapsible BlurView header) → `DefaultAvailabilityEditor` (Settimana tipo + Eccezioni) or `PublicationModeEditor`. Exceptions edited via the `role/availability-exception` page-sheet (`availabilityExceptionStore`). `InstructorManageScreen` + its `AvailabilityEditor` are **legacy/unmounted** (React-Navigation `TabNavigator`, not in Expo Router tree).

### Payments
- → **Booking Flow**: payment profile needed for booking
- → **Settings**: payment method management in SettingsScreen
- → **Backend**: Stripe setup intents, payment history, pay-now flow

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
- → **Availability Editor**: availabilityMode toggle
- → **Payments**: payment method management
- → **Instructor Manage**: cluster settings (durations, booking actors, limits)
- → **Backend**: `getAutoscuolaSettings()`, `updateInstructorSettings()`

### Exam Creation
- → **Booking Flow**: exam is a special appointment type
- → **Settings**: reads cluster config for student grouping
- → **Backend**: `createExam()`, `getStudents()`, `getInstructorSettings()`

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
  - AWAITING → solo `home` (niente settings, payments, notes, quiz)
  - TEORIA → `home` + `quiz` (se `hasQuizAccess`) + eventualmente `notes`
  - PRATICA → `home` + `payments` (se autoPayments) + `notes` + `settings`. Scambi **non** è una tab: si apre da `home/swaps` via CTA "Scambi" (se `swapEnabled`).
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
