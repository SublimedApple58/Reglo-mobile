# Instructor Manage

## What it does
Full appointment management for instructors: create, cancel, reschedule, check-in, no-show, notes, ratings, sick leave.

## Key files
- `src/screens/IstruttoreHomeScreen.tsx` (269KB) — largest screen, instructor hub
- `src/screens/InstructorManageScreen.tsx` (70KB) — detailed management
- `src/screens/InstructorHoursScreen.tsx` — hours reporting
- `src/components/RescheduleAppointmentSheet.tsx` — reschedule UI (modal-in-modal)
- `src/components/WeeklyAgendaView.tsx` — 6-day agenda grid

## Features
- Daily agenda timeline with lesson blocks
- Quick booking suggestion (drag from free slot → appointment proposal)
- Batch confirmation of multiple proposed bookings
- Check-in/no-show status management
- In-progress window detection (15 min before/after)
- Appointment detail editing: lesson types, notes, star ratings
- Reposition to find new available slots
- Sick leave creation (blocks availability, cancels appointments)
- Hours tracking: weekly breakdown, working vs outside hours, bar charts

## API functions used (15+)
`getAppointments`, `getAgendaBootstrap`, `createAppointment`, `cancelAppointment`, `repositionAppointment`, `rescheduleAppointment`, `updateAppointmentStatus`, `updateAppointmentDetails`, `confirmInstructorBooking`, `confirmInstructorBookingBatch`, `suggestInstructorBooking`, `createInstructorSickLeave`, `getInstructorBlocks`, `createInstructorBlock`, `deleteInstructorBlock`, `getInstructorHours`

## Components used
Screen, Card, Badge, BottomSheet, CalendarDrawer, CalendarNavigatorRange, SearchableSelect, SelectableChip, WeeklyAgendaView, RescheduleAppointmentSheet, StarRating, MiniCalendar, RangesEditor

## Connected features
- **Availability Editor** — overlaps in override management
- **Notifications** — appointment changes trigger push
- **Notes** — appointment editing includes notes/ratings
- **Settings** — cluster settings affect behavior
