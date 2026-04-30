# Component & Screen Impact Map — Reglo Mobile

When modifying a feature, read its connected features to verify nothing breaks.

## Shared Component → Screens

| Component | Used by screens | Notes |
|-----------|----------------|-------|
| `BottomSheet` | AllievoHome, AllievoPayments, ClusterSettings, CreateExam, IstruttoreHome, InstructorManage, InstructorVehicles, NotificationOverlay, OwnerInstructor, OwnerVehicles, RescheduleAppointmentSheet, SwapOffers, TitolareHome (14) | iOS + Android separate implementations |
| `TimePickerDrawer` | ClusterSettings, CreateExam, InstructorAvailability, InstructorManage, InstructorVehicles, OwnerVehicles, PublicationModeEditor, RescheduleAppointmentSheet, Settings (9) | Depends on BottomSheet |
| `CalendarDrawer` | AllievoHome, CreateExam, IstruttoreHome, TitolareHome (4) | Depends on MiniCalendar + BottomSheet |
| `RangesEditor` | InstructorManage, OwnerInstructor, PublicationModeEditor (3) | Time range format changes break all availability UIs |
| `SelectableChip` | CalendarNavigator, ClusterSettings, InstructorManage, Settings (4) | |
| `WeeklyAgendaView` | IstruttoreHome, TitolareHome (2) | Shared between instructor and owner |
| `BookingCelebration` | AllievoHome, NotificationOverlay, SwapOffers (3) | 2 variants: 'booking' and 'swap' |
| `StarRating` | IstruttoreHome (input), StudentMyNotes (display), StudentNotesDetail (display) (3) | |
| `RescheduleAppointmentSheet` | IstruttoreHome (1) | Complex: BottomSheet + CalendarDrawer + TimePickerDrawer |
| `MiniCalendar` | InstructorManage, OwnerInstructor + used by CalendarDrawer (3) | |

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
- → **Settings**: `availabilityMode` toggle (default vs publication) lives in Settings
- → **Instructor Manage**: InstructorManageScreen also shows/edits daily overrides
- → **Backend**: `setDailyAvailabilityOverride()`, `publishWeek()`, `unpublishWeek()`

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
