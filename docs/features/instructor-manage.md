# Instructor Manage

## What it does
Full appointment management for instructors: create, cancel, reschedule, check-in, no-show, notes, ratings, sick leave.

## Key files
- `src/screens/IstruttoreHomeScreen.tsx` (269KB) — largest screen, instructor hub
- `src/screens/InstructorManageScreen.tsx` (70KB) — detailed management
- `src/screens/InstructorHoursScreen.tsx` — hours reporting
- `src/components/RescheduleAppointmentSheet.tsx` — reschedule UI (modal-in-modal)
- `src/components/WeeklyAgendaView.tsx` — Google-Calendar-style weekly grid (terza vista "Griglia"); horizontal week carousel (paged FlatList), **ghost-block booking** (hold → blocco draft trascinabile con knob durata + CTA “Scegli i dettagli”, vedi `quick-book.md`), mono-navy Variant A. Dedicated event rendering: individual guide = pill colorata per significato (navy = una delle prime 6 guide obbligatorie dell'allievo; ambra soft = guide successive; rosso soft = l'allievo ha l'esame il giorno dopo — flag `mandatoryLesson`/`examNextDay` annotati dal BE in `getAutoscuolaAppointmentsFiltered`); **esami** = collapsed indigo card (per slot, +count); **guide di gruppo** = collapsed teal card (people icon, N/3 seats); **esami senza orario** = chip in the all-day lane above the grid

## Features
- Daily agenda timeline with lesson blocks
- Quick booking suggestion (drag from free slot → appointment proposal)
- Batch confirmation of multiple proposed bookings
- Check-in/no-show status management
- In-progress window detection (15 min before/after)
- Appointment detail editing: lesson types, notes, star ratings
- Change instructor, location, **vehicle**, and **durata** of a lesson from "Gestisci guida" (auto-save on pick). Vehicle row opens the generic `select-options` picker; each vehicle shows an elegant subtitle (license category + assigned instructor). Backend: `updateAppointmentDetails` accepts `vehicleId` (PATCH `/api/autoscuole/appointments/{id}`)
- **Modifica durata** (2026-07-15): riga "Durata" (icona `time-outline`) sotto Luogo, sia futuro che passato. Apre `optionsPicker` (opzioni `[30,45,60,90,120]` min + durata attuale) → `onChangeDuration` → `updateAppointmentDetails(id, { durationMin })` → `refreshAndSyncDrawer`. Start invariato, `endsAt = start + durationMin`; il BE (azione dettagli condivisa) è permissivo sul passato e ricontrolla i conflitti solo se la durata cresce su una guida futura. `durationMin` è nel `manageLessonStore` snapshot; readOnly (titolare) = riga statica.
- Il **nome allievo** nell'hero di "Gestisci guida" è tappabile (chevron) → apre il modal dettaglio allievo (`/(tabs)/home/student-detail`, stesso route dell'exam sheet, stack nativo sopra la sheet)
- **Note + tastiera nel foglio "Dettagli guida"** (`manage-lesson-details`, 2026-07-16): il foglio `fitToContents` diventa troppo alto quando ci sono le stelline (Tipo + Valutazione + Note) e su iOS la tastiera copriva la textarea Note senza modo di chiuderla se non chiudendo il foglio. Fix: (1) **`InputAccessoryView` con pulsante "Fatto"** (iOS) legato alla textarea via `inputAccessoryViewID` → `Keyboard.dismiss()`; (2) al focus della textarea le sezioni **Tipo guida + Valutazione si comprimono** così il foglio si accorcia e la textarea galleggia sopra la tastiera (come il foglio corto `edit-notes`). La compressione è animata in modo fluido: altezza misurata una volta (`onLayout`) + shared value `collapse` con `withTiming` (300ms, `Easing.bezier(0.22,1,0.36,1)`) su height+opacity+translateY; la sezione resta montata (height→0) e il body ha `gap:0` con lo spacing dentro il blocco che collassa, così non resta un gap fantasma. Alla chiusura tastiera/blur le sezioni riappaiono.
- **Fix valori stale dopo il salvataggio** (`saveLessonDetails` in `IstruttoreHomeScreen`, 2026-07-16): dopo `updateAppointmentDetails` si chiamava solo `loadData()` (aggiorna la lista) ma NON `setSheetLesson`, quindi lo snapshot dello store restava vecchio e riaprendo il sotto-foglio "Dettagli" subito dopo il salvataggio si vedevano i valori vecchi (tipo/voto/note) finché non si chiudeva e riapriva l'intero modal guida. Ora usa `refreshAndSyncDrawer(lessonId)` (come tutte le altre azioni) → risincronizza `sheetLesson` + tipi/rating/note → lo store snapshot è fresco.
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
