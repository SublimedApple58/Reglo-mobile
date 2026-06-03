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
- **Student:** reverse chronological notes-only view, star ratings display
- Feature-gated: `useStudentNotesEnabled()` hook (settings query uses `refetchOnMount: 'always'` so the tab reflects an owner toggle on app reopen)

## Design (StudentMyNotesScreen)
- Collapsible iOS large-title + sticky **blur header** (no back arrow — it's a tab), off-white `colors.background`, no beige.
- Note cards: white surface, radius 24, concentrated neutral shadow, pink date chip (brand touch), gold `StarRating`, per-type tinted chips (`TYPE_THEME`: manovre/urbano/extraurbano/notturna/autostrada/parcheggio). Exam entries: violet left accent + "Esame" badge.
- Empty state: Fluent 3D `fluent-memo.png` in a soft white circle.
- No longer wraps in `Screen` / uses the timeline rail; built like `SwapOffersScreen`.

## API functions used
`getStudents`, `getAppointments`, `getLatestStudentAppointmentNote`, `updateAppointmentDetails`

## Components used
StarRating, ToastNotice, BlurView (+ reanimated header). No longer uses Screen / Skeleton timeline.

## Connected features
- **Instructor Manage** — notes are part of appointment detail editing
