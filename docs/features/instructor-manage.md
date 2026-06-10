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

## Owner / Titolare home (`ownerMode`)
`TitolareHomeScreen` (ruolo `OWNER`, titolare puro senza profilo istruttore) **non è più uno screen a sé**: è un wrapper sottile che rende `<IstruttoreHomeScreen ownerMode />` (stesso pattern del `VehiclesScreen` unificato). Routing in `RoleHomeScreen.tsx`: `OWNER → TitolareHomeScreen`, `INSTRUCTOR*/`→ IstruttoreHomeScreen.

`ownerMode` trasforma la stessa home in **sola lettura + scope "tutti gli istruttori"**:
- **Scope fisso `all`**: `effectiveInstructorId = undefined` → bootstrap/appuntamenti/blocchi caricano le guide di **tutta** la scuola (non di un singolo istruttore). I chip scope sono nascosti.
- **Guard `!instructorId` bypassati** con `&& !ownerMode` (bootstrapParams, `loadData`, render "profilo mancante", `loadOutOfAvailability`); `getInstructorBlocks` **omette** `instructorId` per l'owner.
- **Niente azioni**: FAB nascosto, `canInstructorBook=false` (niente `BookableBand`/quick-book), live card senza check-in.
- **Sheet di gestione in sola lettura**: `manage-lesson`, `exam-manage`, `manage-group-lesson` ricevono un flag `readOnly` (via i rispettivi store) → righe statiche, niente CTA di modifica, niente toolbar/azioni distruttive. Rimozione blocchi/malattia disattivata; overlay "in malattia" soppresso (in scope-all non ha senso).
- **Disponibilità personale assente**: niente marker "Inizio/Fine disponibilità" né band "Libero" → l'itinerario è la pura lista cronologica delle guide di tutti gli istruttori.
- **Mantenuto**: banner + sheet "guide fuori disponibilità" (governance del titolare, già presente nella home istruttore). **Rimosso rispetto alla vecchia home titolare**: creazione festivi via long-press (i festivi restano visibili come dot, ma non si creano dalla home).

File store toccati: `manageLessonStore`, `examManageStore`, `groupLessonManageStore` (campo `readOnly?`).

## Connected features
- **Availability Editor** — overlaps in override management
- **Notifications** — appointment changes trigger push
- **Notes** — appointment editing includes notes/ratings
- **Settings** — cluster settings affect behavior
