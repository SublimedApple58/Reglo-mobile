# Feature Index — Reglo Mobile

## Features

| Feature | Doc | Primary screens |
|---------|-----|----------------|
| Booking Flow | [booking-flow.md](features/booking-flow.md) | `AllievoHomeScreen` |
| Availability Editor | [availability-editor.md](features/availability-editor.md) | `InstructorAvailabilityScreen`, `PublicationModeEditor` |
| Payments | [payments.md](features/payments.md) | `AllievoPaymentsScreen` |
| Swaps | [swaps.md](features/swaps.md) | `SwapOffersScreen` |
| Notifications | [notifications.md](features/notifications.md) | `NotificationOverlay`, `NotificationInboxScreen` |
| Settings | [settings.md](features/settings.md) | `SettingsScreen`, `ClusterSettingsScreen` |
| Exam Creation | [exam-creation.md](features/exam-creation.md) | `CreateExamScreen` |
| Instructor Manage | [instructor-manage.md](features/instructor-manage.md) | `IstruttoreHomeScreen`, `InstructorManageScreen` |
| Notes | [notes.md](features/notes.md) | `InstructorNotesScreen`, `StudentMyNotesScreen` |
| Quiz Teoria | [quiz-theory.md](features/quiz-theory.md) | `QuizHomeScreen`, `QuizSessionScreen`, `QuizResultsScreen` |
| Student Phase | [student-phase.md](features/student-phase.md) | `AllievoAwaitingScreen`, `AllievoTheoryHomeScreen`, `AllievoLicensedScreen`, `PhaseProgressBar`, `_layout.tsx`, `useStudentPhase` |

## Design System

| Doc | Scope |
|-----|-------|
| [design-system.md](design-system.md) | Completo (1215 righe): palette, typography, spacing, radii, shadows, tutti i componenti con props/stili/stati, animazioni, regole, piattaforme |

## Architecture

| Topic | Doc |
|-------|-----|
| Routing & Tabs | [routing.md](architecture/routing.md) |
| Shared Components | [components.md](architecture/components.md) |
| API Layer & Types | [api-layer.md](architecture/api-layer.md) |
| Theme & Design System | [theme.md](architecture/theme.md) |
| Session & Auth | [session-auth.md](architecture/session-auth.md) |
| **Performance Playbook** (canonical, in the `reglo` repo) — diagnose & fix slow screens: non-blocking loads, granular skeletons, TanStack Query, call schema, + backend indexing/Redis | `../../reglo/docs/architecture/performance-playbook.md` |
