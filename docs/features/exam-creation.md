# Exam Creation

## What it does
Create exam appointments for multiple students at once.

## Key files
- `src/screens/CreateExamScreen.tsx` (22KB)

## Features
- Multi-student selection grouped by cluster ("Mio gruppo", "Altro gruppo", unassigned)
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
