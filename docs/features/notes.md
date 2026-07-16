# Notes

## What it does
Instructor writes notes/ratings on completed lessons. Students view their notes.

## Key files
- `src/screens/InstructorNotesScreen.tsx` (17KB) — student list with notes
- `src/screens/StudentMyNotesScreen.tsx` (10KB) — student's notes view
- `src/screens/StudentNotesDetailScreen.tsx` (19KB) — note detail
- `src/components/StarRating.tsx` — 5-star rating component

## Features
- **Instructor:** student list by cluster, morphing search bar, per-appointment notes, call/WhatsApp links
- **Dettagli guida dallo storico** (2026-07-16): in `StudentNotesDetailScreen` ogni riga guida dello storico è **tappabile** (icona matita) → apre il foglio **`manage-lesson-details`** (Tipo guida + Valutazione + Note) precompilato, `openDetails` seeda `manageLessonStore` col minimo che quel foglio legge (`lesson` + `showRating`/`isDetailsEditable`/`pendingAction`/`onSaveDetails`); al salvataggio invia solo i campi cambiati via `updateAppointmentDetails` + `loadData()`. `showRating` = guida effettuata (`checked_in`/`completed`/`no_show`). Lo schermo è raggiungibile da **due stack** (home `student-detail` e notes `[studentId]`): `manage-lesson-details` è ora registrato in ENTRAMBI i `_layout` (`app/(tabs)/notes/manage-lesson-details.tsx` re-esporta quello home) e `openDetails` naviga alla route dello stack corrente via `useSegments()`. L'istruttore può editare solo le proprie guide (guardia BE, messaggio chiaro); l'owner tutte.
- **Student:** reverse chronological notes-only view, star ratings display
- Feature-gated: `useStudentNotesEnabled()` hook (settings query uses `refetchOnMount: 'always'` so the tab reflects an owner toggle on app reopen)

## Design (StudentMyNotesScreen)
- Collapsible iOS large-title + sticky **blur header** (no back arrow — it's a tab), off-white `colors.background`, no beige.
- Note cards: white surface, radius 24, concentrated neutral shadow, pink date chip (brand touch), gold `StarRating`, per-type tinted chips (`TYPE_THEME`: manovre/urbano/extraurbano/notturna/autostrada/parcheggio). Exam entries: violet left accent + "Esame" badge.
- **Group-lesson notes** (`type==='group_lesson'`, 2026-06-16): teal sibling of the exam card — teal left accent `#10B981`, teal date chip (`#D1FAE5`/`#0F766E`), "Guida di gruppo" badge (people icon). These are the **per-student notes** the instructor wrote on the group-lesson seat; they arrive through the same `getAppointments` path (no new API), so a participant simply sees them here. See `group-lessons.md`.
- Empty state: Fluent 3D `fluent-memo.png` in a soft white circle.
- No longer wraps in `Screen` / uses the timeline rail; built like `SwapOffersScreen`.

## API functions used
`getStudents`, `getAppointments`, `getLatestStudentAppointmentNote`, `updateAppointmentDetails`

## Components used
StarRating, ToastNotice, BlurView (+ reanimated header). No longer uses Screen / Skeleton timeline.

## Connected features
- **Instructor Manage** — notes are part of appointment detail editing
