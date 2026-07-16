# Exam Creation

## What it does
Create exam appointments for zero or more students at once. Un esame si può creare **senza allievi** (spesso l'autoscuola non sa subito chi parteciperà) e riempirlo dopo dal foglio di gestione.

## Key files
- `src/screens/CreateExamScreen.tsx` (22KB) — crea l'esame (0+ allievi)
- `app/(tabs)/home/exam-manage.tsx` — foglio "Esame di guida": aggiungi/rimuovi allievi, cambia orario, annulla
- `src/utils/weeklyAgenda.ts` — `isExamPlaceholder()` + conteggi esame

## Features
- Multi-student selection grouped by cluster ("Mio gruppo", "Altro gruppo", unassigned)
- **Zero allievi ammessi (2026-07-16)**: il tasto "Crea esame" non richiede più almeno un allievo; l'esame vuoto compare in agenda come "Nessun allievo" e si riempie toccandolo → `+`. Modello backend = riga segnaposto `studentId=null` convertita al primo allievo (vedi `../reglo` appointments.md, `materializeExamSlot`). Sul mobile un segnaposto è `type==='esame' && !studentId` (`isExamPlaceholder`), escluso da conteggi/liste in `exam-manage`, `IstruttoreHomeScreen`, `WeeklyLiveCard`, `WeeklyAgendaView`.
- Searchable student picker with smart sorting (selected first, then cluster)
- Date, start/end time selection (default 1h)
- Optional exam notes

## API functions used
`getStudents`, `getInstructorSettings`, `createExam`

## Components used
Screen, BottomSheet, CalendarDrawer, TimePickerDrawer

## Connected features
- **Booking Flow** — exam is a special appointment type
- **Settings** — reads cluster config for student grouping
