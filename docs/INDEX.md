# Feature Index — Reglo Mobile

## Features

| Feature | Doc | Primary screens |
|---------|-----|----------------|
| Booking Flow | [booking-flow.md](features/booking-flow.md) | `AllievoHomeScreen` |
| Guide annullate (vista allievo) | [guide-annullate.md](features/guide-annullate.md) | `LessonsOverview`, `home/all-lessons`, `more/le-tue-guide`, `MoreScreen`, `allLessonsStore` |
| Availability Editor | [availability-editor.md](features/availability-editor.md) | `InstructorAvailabilityScreen`, `DefaultAvailabilityEditor`, `PublicationModeEditor`, `role/availability-exception` |
| Swaps | [swaps.md](features/swaps.md) | `SwapOffersScreen` |
| Notifications | [notifications.md](features/notifications.md) | `NotificationOverlay`, `NotificationInboxScreen` |
| Settings | [settings.md](features/settings.md) | `SettingsScreen`, `ClusterSettingsScreen` |
| Exam Creation | [exam-creation.md](features/exam-creation.md) | `CreateExamScreen` |
| Instructor Manage | [instructor-manage.md](features/instructor-manage.md) | `IstruttoreHomeScreen` (+ `TitolareHomeScreen` = wrapper `ownerMode`, sola lettura), `InstructorManageScreen` |
| Quick-book | [quick-book.md](features/quick-book.md) | `IstruttoreHomeScreen`, `home/quick-book`, `BookingForm`, `BlockForm` |
| Lezione teorica (agenda) | [lezione-teorica.md](features/lezione-teorica.md) | `IstruttoreHomeScreen`, `DayItinerary`, `WeeklyAgendaView`, `weeklyAgenda` (`BLOCK_PRESENTATION.theory`), `BlockForm`/`blockSheetStore` (`kind`), `home/theory-lesson` |
| Notes | [notes.md](features/notes.md) | `InstructorNotesScreen`, `StudentMyNotesScreen` |
| Locations | [locations.md](features/locations.md) | `LocationsScreen`, `more/location-form` |
| Vehicles | [vehicles.md](features/vehicles.md) | `VehiclesScreen`, `OwnerVehiclesScreen`, `InstructorVehiclesScreen`, `more/vehicle-form` |
| Group lessons | [group-lessons.md](features/group-lessons.md) | `CreateGroupLessonScreen`, `GroupLessonInvitesScreen`, `DayItinerary`/`weeklyAgenda` (teal card), `home/create-group-lesson`, `home/group-lesson-invites`, `home/manage-group-lesson` (+ `-participants`) |
| Instructor Hours | [instructor-hours.md](features/instructor-hours.md) | `InstructorHoursScreen` |
| Quiz Teoria | [quiz-theory.md](features/quiz-theory.md) | `QuizHomeScreen`, `QuizSessionScreen`, `QuizResultsScreen` |
| Student Phase | [student-phase.md](features/student-phase.md) | `AllievoAwaitingScreen`, `AllievoTheoryHomeScreen`, `AllievoLicensedScreen`, `PhaseProgressBar`, `_layout.tsx`, `useStudentPhase` |
| Student moto experience | [student-moto-experience.md](features/student-moto-experience.md) | `lessonArt.ts`, `license.ts`, `AllievoHomeScreen`, `all-lessons`, `GlassTabBar`, `_layout.tsx`, `group-lesson-detail`, `GroupLessonInvitesScreen` |
| Password Reset | [password-reset.md](features/password-reset.md) | `PasswordResetScreen`, `(auth)/password-reset(-sheet)`, `LoginScreen.onForgot` |
| Phone Gate | [phone-gate.md](features/phone-gate.md) | `PhoneGateScreen`, `(tabs)/_layout.tsx` |

## Design System

| Doc | Scope |
|-----|-------|
| [design-system.md](design-system.md) | Completo (1215 righe): palette, typography, spacing, radii, shadows, tutti i componenti con props/stili/stati, animazioni, regole, piattaforme |
| [patterns/keyboard-accessory.md](patterns/keyboard-accessory.md) | Chiusura tastiera iOS: quando toolbar "Fatto" (`useDoneAccessory`) vs `returnKeyType="search"`/`"done"`; auto-wiring in `Input` |

## Architecture

| Topic | Doc |
|-------|-----|
| **Git flow & ambienti** (branch, staging, OTA prod) | [git-flow.md](git-flow.md) |
| Routing & Tabs | [routing.md](architecture/routing.md) |
| Shared Components | [components.md](architecture/components.md) |
| API Layer & Types | [api-layer.md](architecture/api-layer.md) |
| Theme & Design System | [theme.md](architecture/theme.md) |
| Session & Auth | [session-auth.md](architecture/session-auth.md) |
| **Performance Playbook** (canonical, in the `reglo` repo) — diagnose & fix slow screens: non-blocking loads, granular skeletons, TanStack Query, call schema, + backend indexing/Redis | `../../reglo/docs/architecture/performance-playbook.md` |
