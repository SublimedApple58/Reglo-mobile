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
- Feature-gated: `useStudentNotesEnabled()` hook

## API functions used
`getStudents`, `getAppointments`, `getLatestStudentAppointmentNote`, `updateAppointmentDetails`

## Components used
Screen, Skeleton, StarRating

## Connected features
- **Instructor Manage** — notes are part of appointment detail editing
