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
| Notifications | [notifications.md](features/notifications.md) | `NotificationOverlay`, `NotificationInboxScreen` (clay: sezioni per giorno, indietro anche da tab nell'app istruttore) |
| Settings | [settings.md](features/settings.md) | `SettingsScreen`, `MoreScreen` (tab «Tu»: profilo, Gestione, «Esci»), `ClusterSettingsScreen`, `ClayAccountParts` |
| Avvisi su WhatsApp — consenso (REG-500) | [whatsapp-alerts.md](features/whatsapp-alerts.md) | `WhatsAppAlertsRow`, `settings/profile-edit`, `more/profile-edit`, `SignupScreen` |
| Associazione istruttore via QR (REG-451) | [instructor-qr-link.md](features/instructor-qr-link.md) | `InstructorLinkScreen`, `settings/associa-istruttore`, `+native-intent`, `pendingInstructorLink`, `SettingsScreen` (riga Scansiona QR) |
| Foto profilo + Firma allievo | [student-photo-signature.md](features/student-photo-signature.md) | `settings/profile-edit`, `settings/signature`, `SettingsScreen` (avatar), `apiClient` (FormData) |
| Exam Creation | [exam-creation.md](features/exam-creation.md) | `CreateExamScreen` |
| Instructor Manage | [instructor-manage.md](features/instructor-manage.md) | `IstruttoreHomeScreen` (+ `TitolareHomeScreen` = wrapper `ownerMode`, sola lettura), `InstructorManageScreen` |
| Agenda istruttore / titolare — solo vista Settimana (griglia), clay v2 (REG-639) | [agenda-istruttore.md](features/agenda-istruttore.md) | `IstruttoreHomeScreen` (+ `TitolareHomeScreen`), `WeeklyAgendaView`, `src/utils/agendaLook.ts`, `home/add-action` («Nuovo»), `home/quick-book` |
| Colori blocchi agenda (criterio Aspetto) | [agenda-block-colors.md](features/agenda-block-colors.md) | `src/utils/agendaColors.ts` (+ `AGENDA_BLOCK_BAR`), `src/utils/agendaLook.ts` (fondo pastello pieno + ombra in tinta, REG-639), `WeeklyAgendaView` (blocchi), `AppearanceSettingsScreen` + `more/appearance` (pannello owner), `more/color-picker`, `regloApi.ts` (`AutoscuolaSettings.agendaColor*`), `utils/agendaVehicle.ts` (veicolo nei blocchi, REG-633) |
| Dettaglio allievo (foglio istruttore: info, da fare, andamento, storico ultime 5) | [dettaglio-allievo.md](features/dettaglio-allievo.md) | `StudentNotesDetailScreen`, `LessonHistoryRow`, `LessonHistorySheet`, `home/lesson-history` + `notes/lesson-history`, `lessonHistoryStore` |
| Tipo guida moto (birilli/strada, sola lettura) | [moto-lesson-type.md](features/moto-lesson-type.md) | `src/utils/motoLessonType.ts`, `app/(tabs)/home/manage-lesson.tsx` (riga), `StudentNotesDetailScreen` (chip), `regloApi.ts` (`AutoscuolaAppointment.motoLessonType`) |
| Quick-book | [quick-book.md](features/quick-book.md) | `IstruttoreHomeScreen`, `WeeklyAgendaView` (blocco fantasma), `home/quick-book` (FormSheet + `ClaySegmented`), `BookingForm`, `BlockForm` |
| Lezione teorica (agenda) | [lezione-teorica.md](features/lezione-teorica.md) | `IstruttoreHomeScreen`, `DayItinerary`, `WeeklyAgendaView`, `weeklyAgenda` (`BLOCK_PRESENTATION.theory`), `BlockForm`/`blockSheetStore` (`kind`), `home/theory-lesson` |
| Pagellino di valutazione (REG-443) | [evaluation-sheet.md](features/evaluation-sheet.md) | `home/manage-lesson-details`, `StarRating`, `IstruttoreHomeScreen`, `StudentNotesDetailScreen`, `EvaluationSheetScreen` (Altro → Pagellino), `EvaluationItemSheet` |
| Notes | [notes.md](features/notes.md) | `InstructorNotesScreen`, `StudentMyNotesScreen` |
| Pagamenti guide (REG-450) | [lesson-payments.md](features/lesson-payments.md) | `StudentPaymentsScreen`, `home/student-payments` + `notes/student-payments`, `studentPaymentsStore`, `src/utils/lessonPayments.ts`, `StudentNotesDetailScreen` (blocco Pagamenti); storico chi/quando REG-637: `PaymentHistorySheet`, `home|notes/payment-history`, `paymentHistoryStore`, `src/utils/paymentHistory.ts` |
| Locations | [locations.md](features/locations.md) | `LocationsScreen`, `more/location-form` |
| Vehicles | [vehicles.md](features/vehicles.md) | `VehiclesScreen`, `OwnerVehiclesScreen`, `InstructorVehiclesScreen`, `more/vehicle-form` |
| Group lessons | [group-lessons.md](features/group-lessons.md) | `CreateGroupLessonScreen`, `GroupLessonInvitesScreen`, `WeeklyAgendaView` (card a fondo pastello verde/ambra, `agendaLook`), `home/create-group-lesson`, `home/group-lesson-invites`, `home/manage-group-lesson` (+ `-participants`) |
| Instructor Hours | [instructor-hours.md](features/instructor-hours.md) | `InstructorHoursScreen` |
| Quiz Teoria | [quiz-theory.md](features/quiz-theory.md) | `QuizHomeScreen`, `QuizSessionScreen`, `QuizResultsScreen` |
| Student Phase (+ percorsi multipli REG-458) | [student-phase.md](features/student-phase.md) | `AllievoAwaitingScreen`, `AllievoTheoryHomeScreen`, `AllievoLicensedScreen`, `PhaseProgressBar`, `_layout.tsx`, `useStudentPhase`, `StudentNotesDetailScreen` |
| Student moto experience | [student-moto-experience.md](features/student-moto-experience.md) | `lessonArt.ts`, `license.ts`, `AllievoHomeScreen`, `all-lessons`, `GlassTabBar`, `_layout.tsx`, `group-lesson-detail`, `GroupLessonInvitesScreen` |
| Reglo Road — guida in diretta (REG-638): GPS, percorso, segnalazioni, pagellino, riepilogo; percorso allievo | [reglo-road.md](features/reglo-road.md) | `app/road/*` (stack a tutto schermo), `src/road/*` (tracking, code, uploader, store, RoadController), `home/road-invite`, `home/road-privacy`, `home/road-map`, `lesson-detail` (blocco percorso), `WeeklyLiveCard` (`onEnterRoad`), `manage-lesson-details` (variante `road`); punti critici (REG-646): `drive/punti-critici`, `drive/punto-critico`, `src/road/hotspotsStore.ts`; giro della prossima guida (REG-649): `src/road/planStore.ts`, `src/components/road/RoadPlanCard.tsx` |
| Password Reset | [password-reset.md](features/password-reset.md) | `PasswordResetScreen`, `(auth)/password-reset(-sheet)`, `LoginScreen.onForgot` |
| Phone Gate | [phone-gate.md](features/phone-gate.md) | `PhoneGateScreen`, `(tabs)/_layout.tsx` |
| License Path Gate (REG-410) | [license-path-gate.md](features/license-path-gate.md) | `LicensePathGateScreen`, `(tabs)/_layout.tsx`, `useStudentPhase`, `regloApi` (`setLicensePath`), `utils/license` (`STUDENT_LICENSE_CATEGORIES`) |

## Design System

| Doc | Scope |
|-----|-------|
| [design-system.md](design-system.md) | **§0 Clay leggero (REG-639, in prod dal 28/10/2026): IL design system com'è oggi — bianco/nero, volume clay (`CLAY_SHADOW`, `CLAY_CTA`), vita dosata per importanza (§0.2), testata nativa che collassa `ClayLargeTitleScroll` (§0.5), fogli adattivi `FormSheet` (§0.6), righe in card clay, picker a spunta, stepper, segmentato clay e nativo `@expo/ui` (§0.7), animazioni senza rimbalzo (§0.8), icone 3D trasparenti con prompt STILE, reference in `docs/assets/icone-ref/` e strumenti di scontorno in `docs/assets/icone-3d/` (§0.9), componenti (§0.10); vince sul resto.** Completo: palette, typography, spacing, radii, shadows, componenti storici, animazioni, regole, piattaforme. **§13.2.1**: layout interno dei form sheet |
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
