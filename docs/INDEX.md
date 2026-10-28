# Feature Index — Reglo Mobile

## Features

| Feature | Doc | Primary screens |
|---------|-----|----------------|
| Booking Flow | [booking-flow.md](features/booking-flow.md) | `AllievoHomeScreen` |
| Le tue guide — storico allievo (Tutte/Programmate/Svolte/Annullate) | [guide-annullate.md](features/guide-annullate.md) | `LessonsOverview`, `home/all-lessons`, `settings/le-tue-guide`, `SettingsScreen`, `allLessonsStore` |
| Availability Editor | [availability-editor.md](features/availability-editor.md) | `InstructorAvailabilityScreen`, `DefaultAvailabilityEditor`, `PublicationModeEditor`, `role/availability-exception` |
| Swaps | [swaps.md](features/swaps.md) | `SwapOffersScreen` |
| Esito esame (idoneo/respinto dal foglio esame) | [exam-outcome.md](features/exam-outcome.md) | `app/(tabs)/home/exam-manage.tsx`, `regloApi.setExamOutcome`, campo `examOutcome` sull'appuntamento |
| Pronto per l'esame (exam-ready) | [exam-ready.md](features/exam-ready.md) | `StudentNotesDetailScreen`, `CreateExamScreen`, `select-exam-students`, `examStudentsStore` |
| Notifications | [notifications.md](features/notifications.md) | `NotificationOverlay`, `NotificationInboxScreen` |
| Settings | [settings.md](features/settings.md) | `SettingsScreen`, `ClusterSettingsScreen` |
| Avvisi su WhatsApp — consenso (REG-500) | [whatsapp-alerts.md](features/whatsapp-alerts.md) | `WhatsAppAlertsRow`, `settings/profile-edit`, `more/profile-edit`, `SignupScreen` |
| Associazione istruttore via QR (REG-451) | [instructor-qr-link.md](features/instructor-qr-link.md) | `InstructorLinkScreen`, `settings/associa-istruttore`, `+native-intent`, `pendingInstructorLink`, `SettingsScreen` (riga Scansiona QR) |
| Foto profilo + Firma allievo | [student-photo-signature.md](features/student-photo-signature.md) | `settings/profile-edit`, `settings/signature`, `SettingsScreen` (avatar), `apiClient` (FormData) |
| Exam Creation | [exam-creation.md](features/exam-creation.md) | `CreateExamScreen` |
| Instructor Manage | [instructor-manage.md](features/instructor-manage.md) | `IstruttoreHomeScreen` (+ `TitolareHomeScreen` = wrapper `ownerMode`, sola lettura), `InstructorManageScreen` |
| Colori blocchi agenda (criterio Aspetto) | [agenda-block-colors.md](features/agenda-block-colors.md) | `src/utils/agendaColors.ts`, `WeeklyAgendaView`/`DayItinerary`/`IstruttoreHomeScreen` (blocchi), `AppearanceSettingsScreen` + `more/appearance` (pannello owner), `more/color-picker`, `regloApi.ts` (`AutoscuolaSettings.agendaColor*`), `utils/agendaVehicle.ts` (veicolo nei blocchi, REG-633) |
| Tipo guida moto (birilli/strada, sola lettura) | [moto-lesson-type.md](features/moto-lesson-type.md) | `src/utils/motoLessonType.ts`, `app/(tabs)/home/manage-lesson.tsx` (riga), `StudentNotesDetailScreen` (chip), `regloApi.ts` (`AutoscuolaAppointment.motoLessonType`) |
| Quick-book | [quick-book.md](features/quick-book.md) | `IstruttoreHomeScreen`, `home/quick-book`, `BookingForm`, `BlockForm` |
| Lezione teorica (agenda) | [lezione-teorica.md](features/lezione-teorica.md) | `IstruttoreHomeScreen`, `DayItinerary`, `WeeklyAgendaView`, `weeklyAgenda` (`BLOCK_PRESENTATION.theory`), `BlockForm`/`blockSheetStore` (`kind`), `home/theory-lesson` |
| Pagellino di valutazione (REG-443) | [evaluation-sheet.md](features/evaluation-sheet.md) | `home/manage-lesson-details`, `StarRating`, `IstruttoreHomeScreen`, `StudentNotesDetailScreen`, `EvaluationSheetScreen` (Altro → Pagellino), `EvaluationItemSheet` |
| Notes | [notes.md](features/notes.md) | `InstructorNotesScreen`, `StudentMyNotesScreen` |
| Pagamenti guide (REG-450) | [lesson-payments.md](features/lesson-payments.md) | `StudentPaymentsScreen`, `home/student-payments` + `notes/student-payments`, `studentPaymentsStore`, `src/utils/lessonPayments.ts`, `StudentNotesDetailScreen` (blocco Pagamenti); storico chi/quando REG-637: `PaymentHistorySheet`, `home|notes/payment-history`, `paymentHistoryStore`, `src/utils/paymentHistory.ts` |
| Locations | [locations.md](features/locations.md) | `LocationsScreen`, `more/location-form` |
| Vehicles | [vehicles.md](features/vehicles.md) | `VehiclesScreen`, `OwnerVehiclesScreen`, `InstructorVehiclesScreen`, `more/vehicle-form` |
| Group lessons | [group-lessons.md](features/group-lessons.md) | `CreateGroupLessonScreen`, `GroupLessonInvitesScreen`, `DayItinerary`/`weeklyAgenda` (teal card), `home/create-group-lesson`, `home/group-lesson-invites`, `home/manage-group-lesson` (+ `-participants`) |
| Instructor Hours | [instructor-hours.md](features/instructor-hours.md) | `InstructorHoursScreen` |
| Quiz Teoria | [quiz-theory.md](features/quiz-theory.md) | `QuizHomeScreen`, `QuizSessionScreen`, `QuizResultsScreen` |
| Student Phase (+ percorsi multipli REG-458) | [student-phase.md](features/student-phase.md) | `AllievoAwaitingScreen`, `AllievoTheoryHomeScreen`, `AllievoLicensedScreen`, `PhaseProgressBar`, `_layout.tsx`, `useStudentPhase`, `StudentNotesDetailScreen` |
| Student moto experience | [student-moto-experience.md](features/student-moto-experience.md) | `lessonArt.ts`, `license.ts`, `AllievoHomeScreen`, `all-lessons`, `GlassTabBar`, `_layout.tsx`, `group-lesson-detail`, `GroupLessonInvitesScreen` |
| Reglo Road — guida in diretta (REG-638): GPS, percorso, segnalazioni, pagellino, riepilogo; percorso allievo | [reglo-road.md](features/reglo-road.md) | `app/road/*` (stack a tutto schermo), `src/road/*` (tracking, code, uploader, store, RoadController), `home/road-invite`, `home/road-privacy`, `home/road-map`, `lesson-detail` (blocco percorso), `WeeklyLiveCard` (`onEnterRoad`), `manage-lesson-details` (variante `road`) |
| Password Reset | [password-reset.md](features/password-reset.md) | `PasswordResetScreen`, `(auth)/password-reset(-sheet)`, `LoginScreen.onForgot` |
| Phone Gate | [phone-gate.md](features/phone-gate.md) | `PhoneGateScreen`, `(tabs)/_layout.tsx` |
| License Path Gate (REG-410) | [license-path-gate.md](features/license-path-gate.md) | `LicensePathGateScreen`, `(tabs)/_layout.tsx`, `useStudentPhase`, `regloApi` (`setLicensePath`), `utils/license` (`STUDENT_LICENSE_CATEGORIES`) |

## Design System

| Doc | Scope |
|-----|-------|
| [design-system.md](design-system.md) | **§0 Clay v2 (REG-639, dal 28/10/2026): lo stile dell'app — bianco e nero, volume clay (`CLAY_SHADOW`), poche icone 3D generate con l'AI in stile unico (`Icon3D`, §0.4; Fluent bandite), componenti in `src/components/clay/`; vince sul resto.** Completo: palette, typography, spacing, radii, shadows, tutti i componenti con props/stili/stati, animazioni, regole, piattaforme. **§13.2.1**: layout interno dei form sheet (respiro, CTA ancorata in fondo, perché non sommare `insets.bottom`) |
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
