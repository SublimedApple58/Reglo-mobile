# Vehicles (Veicoli)

## What it does
Instructor/owner management of the driving school's vehicles: list, create, rename, activate/deactivate, and configure each vehicle's weekly availability (days + start/end time). Both roles see the same UI.

## Key files
- `src/screens/VehiclesScreen.tsx` — **shared implementation** (collapsible large-title blur header, flat rows, ActionSheet). Single source of truth for both roles.
- `src/screens/OwnerVehiclesScreen.tsx` / `src/screens/InstructorVehiclesScreen.tsx` — thin wrappers; Instructor wrapper guards on `instructorId`.
- `app/(tabs)/more/vehicles.tsx` — route, switches wrapper by role (`isOwner`/`isInstructor`).
- `app/(tabs)/more/vehicle-form.tsx` — add/edit **page-sheet modal route** (`presentation: 'modal'`): the form grew long/variable-length (license + assignment + availability) so it must scroll → migrated from `formSheet`+`fitToContents` to a full page sheet with a `ScrollView` body + pinned footer (Salva). Driven by `vehicleFormStore`. Does create/update + availability persistence itself.
- `app/(tabs)/more/time-picker.tsx` — formSheet time picker for the availability start/end (seeded via `timePickerStore`). Mirror of `notes/time-picker.tsx`.
- `src/stores/vehicleFormStore.ts` — publishes `{ initial, availabilityWeeks, onChanged }` to the form route.

## Usage modes + auto al seguito (2026-06-24 redesign)
The 1:1 fixed-vehicle model below is **superseded**. Instructor↔vehicle is now **many-to-many** with three usage modes, and a moto lesson can reserve **two vehicles** (moto + follow car). Backend reference: `reglo/docs/features/vehicles.md` + memory `project_vehicles_redesign`.

- **Three modes** in `more/vehicle-form.tsx` (owner only; a plain instructor still just self-assigns exclusivity):
  - **Esclusivo** — `assignedInstructorId` = the one instructor who owns the vehicle (an instructor may own several now; no more silent stealing). Exclusive-only `followsInstructorAvailability` toggle.
  - **Pool** — `poolInstructorIds` (multiselect chips): only those instructors can draw it.
  - **Aperto** — no exclusive owner + empty pool = all instructors (the default, = pre-redesign behaviour).
  - A segmented "Modalità di utilizzo" control switches between the three; the payload maps mode → `assignedInstructorId` + `poolInstructorIds`.
- **Manutenzione**: an "In manutenzione" toggle sets `status:'maintenance'` — excluded from matching like inactive, but keeps its assignment and does NOT cancel existing appointments.
- **Auto al seguito (follow car)** + **moto aggiuntive (2026-06-30)**: the follow-car rule is now a **single global toggle** for all moto categories (BE `followCarMotoEnabled`; the mobile `followCarRules` map still works, now all-moto-on/off). In `BookingForm` the vehicle drives the form: pick a moto and the **"Auto al seguito"** (required, gated on the rule) + **"Moto aggiuntive"** rows appear, pick a car and they hide. The reveal/hide is animated (reanimated `FadeInDown`/`FadeOut` + `LinearTransition`) so the form "enriches" smoothly instead of snapping. (The **web** create dialog uses a different model — a mode-first Auto/Moto selector — see `reglo/docs/features/vehicles.md`.)

**"Gestisci guida" Veicoli editor (2026-06-30, Airbnb redesign):** for a **moto guide** (primary vehicle is a moto) `manage-lesson` shows a single **"Veicoli" summary row** (`motorbike` icon, `Guzzi +2 moto` / sub `Auto al seguito: Fiat 500`) that opens a **dedicated form sheet** `app/(tabs)/home/manage-lesson-vehicles.tsx` (`TALL_SHEET` + `SheetScaffold`, X close, "Fatto" footer) — kept off the main screen so it doesn't clutter. The sheet is split into two groups:
- **Moto** — the motos as chips: the primary tagged `PRINC.` (tap → moto picker, swaps the primary), each extra moto with a `×` to remove it, and a dashed **"Aggiungi"** chip → multiselect of eligible motos.
- **Auto al seguito** — its own row: the car name (tap → B-car picker, swaps it) with a `×` to remove **only when the global follow-car rule does not require it** (an `obbligatoria` tag shows when required). When none is set, a dashed **"Aggiungi auto al seguito"** row.

Both the summary row and the sheet read the same `manageLessonStore` snapshot. All edits persist immediately via `regloApi.updateAppointmentDetails(lessonId, { vehicleId | extraMotoVehicleIds | followVehicleId })` then refetch (no optimistic update); the sheet re-renders from the refreshed store. An auto/unassigned guide keeps the inline single "Veicolo" picker row. Picker eligibility: every picker is first filtered to vehicles **the lesson's instructor can use** (`utils/vehicles.ts` `instructorCanUseVehicle` — exclusivity/pool, shared with the group-lesson screen). Then: the **primary moto** also requires **student-license** eligibility (moto hierarchy via `vehicleServesStudent`); **extra motos** follow the **same student-license hierarchy** as the primary (equal-or-lower moto category, `AM<A1<A2<A`) on top of instructor-usability — an AM student can only add AM motos, never higher (fixed 2026-07-01; earlier they were wrongly unfiltered); the **follow car** is any category-B car. Every moto option in the pickers shows its **license category** as a subtitle (`licenseCategoryLabel`). `ManageLessonVehicle` carries `assignedInstructorId`/`poolInstructorIds` for this. Handlers (`onChangeExtraMotos`, `onChangeFollowVehicle`) + `studentLicense` + `followCarRules` live in `ManageLessonData` (`manageLessonStore`), wired from `IstruttoreHomeScreen.buildManageSnapshot`. The **web** PATCH route `/api/autoscuole/appointments/[id]` now forwards `extraMotoVehicleIds`/`followVehicleId` to `updateAutoscuolaAppointmentDetails` (it previously dropped them). An **auto / unassigned** guide keeps the single "Veicolo" row; the hero meta drops the joined vehicle string for moto guides. Owner/titolare = read-only (no chips controls).

**License eligibility (2026-06-30):** the student picker (`select-student`) shows a license badge; the booking flow validates vehicle⇄student with the **moto hierarchy** (`vehicleServesStudent` / `licenseCategoryEligible` in `src/utils/license.ts`: AM < A1 < A2 < A, a student is eligible for motos ≤ their category; B is separate). The vehicle picker only offers vehicles eligible for the chosen student, picking a student clears a now-incompatible vehicle, and confirm is blocked on a mismatch. `bookingSheetStore` now carries the student's `licenseCategory`/`transmission` + the vehicle `transmission`. The two group-lesson screens reuse the same shared `vehicleServesStudent`. Sent on single + batch confirm as `followVehicleId` + `extraMotoVehicleIds` (seeded into `bookingSheetStore` with vehicle `licenseCategory` + `followCarRules`). Mobile **displays** the full set as `Moto + Moto2 + Auto` in the instructor agenda meta, lesson drawer, live card and `StudentNotesDetailScreen` timeline — sourced from `AutoscuolaAppointmentWithRelations.followVehicle` + `.extraMotoVehicles` (join rows delivered by the agenda bootstrap).
- **`VehiclesScreen` subtitle**: shows the usage mode + a maintenance/inactive tag; `isMine` = exclusive-to-me **OR** in-my-pool.

## Fixed vehicle per instructor (2026-06-09 — SUPERSEDED by the 2026-06-24 redesign above)
A vehicle can be the **fixed vehicle of one instructor** (1:1). Bookings made with that instructor auto-use it (the student never picks). Optional/nullable. **All assignment lives in the Veicoli section** (`app/(tabs)/more/vehicle-form.tsx`) — NOT in cluster settings, so instructors without a cluster can still self-assign.
- **Owner** (`isOwner(autoscuolaRole)`): an "Istruttore assegnato" picker (ActionSheet; instructors via `regloApi.getInstructors`).
- **Instructor** (non-owner): a "Assegna a me questo veicolo" `ToggleSwitch` (uses `session.instructorId`). If the vehicle is already bound to a *different* instructor, a read-only "Assegnato a un altro istruttore" note is shown instead (no stealing).
- Both send `assignedInstructorId` in `updateVehicle`. The BE treats the fixed vehicle as a single slot per instructor: assigning a new one **auto-releases** the instructor's previous vehicle (no error).
- **Availability mode**: when assigned, the form shows a "Segue la disponibilità dell'istruttore" `ToggleSwitch` (`followsInstructorAvailability`, default on). When on, the vehicle's own availability editor is hidden and its stored availability is left untouched on save.
- **Quick-book**: `IstruttoreHomeScreen` seeds `bookingSheetStore.defaultVehicleId` with the instructor's fixed vehicle (`vehicles.find(v => v.assignedInstructorId === instructorId)`), still editable in `BookingForm` (override allowed).

## License categories (2026-06-09, 2° mattone modulo Veicoli)
Ogni veicolo serve **una** categoria patente (`B | AM | A1 | A2 | A`) + un cambio (`manual | automatic`); ogni allievo in PRATICA persegue un percorso patente. Il matcher BE abbina l'allievo solo a un istruttore con un veicolo idoneo a categoria **e** cambio (istruttore moto = mai allievi auto). Tutta la logica è **gated su `vehiclesEnabled`** lato BE.
- **Idoneità istruttore = derivata dal veicolo** (nessun campo istruttore): fisso moto ⇒ solo moto; senza fisso ⇒ disponibile solo se un veicolo del pool della categoria giusta è libero.
- **Mobile imposta solo il veicolo** (categoria+cambio nel form). Il percorso dell'allievo lo imposta il **titolare da web** (mobile non ha edit allievo). L'app allievo non sceglie nulla (auto-uso BE).
- **Dettaglio allievo (istruttore/titolare)** `StudentNotesDetailScreen`: mostra il percorso patente come chip sotto il nome (front del flip-card) + riga "Percorso patente" in "Dati personali" (back). Dato letto da `getStudents` (`AutoscuolaStudent.licenseCategory/transmission`), trovato per id.
- **Home allievo** `AllievoHomeScreen`: pill col percorso patente accanto al nome dell'autoscuola (sotto il greeting). Dato da `useStudentPhase` → `StudentPhasePayload.licenseCategory/transmission` (via `/api/autoscuole/me`).
- **Costanti** `src/utils/license.ts` (`LICENSE_CATEGORIES`, `TRANSMISSIONS`, label IT, `transmissionLabel`).
- **Form veicolo** (`more/vehicle-form.tsx`): due picker (ActionSheet iOS / Alert Android) "Categoria patente" + "Cambio", visibili sia in create che edit, inviati in `createVehicle`/`updateVehicle`. Default B/manuale.
- **Lista** (`VehiclesScreen.tsx`): sottotitolo riga mostra `targa · B · Manuale`. Se il veicolo è assegnato all'istruttore loggato (`vehicle.assignedInstructorId === session.instructorId`): pill navy **"Il tuo"** accanto al nome + icona `car-sport` (invece di `car-outline`).
- **Quick-book** (`IstruttoreHomeScreen`): invariato — il veicolo fisso è idoneo per definizione; il literal veicolo provvisorio passa `licenseCategory`/`transmission`.

## Data & API
- Type `AutoscuolaVehicle` (`name`, `plate`, `status` ora `active|inactive|maintenance`, `assignedInstructorId` = esclusivo, `poolInstructorIds`, `followsInstructorAvailability`, `licenseCategory`, `transmission`). `CreateVehicleInput`/`UpdateVehicleInput` accettano `assignedInstructorId?`/`poolInstructorIds?`/`licenseCategory?`/`transmission?`/`status?`. `AutoscuolaAppointmentWithRelations` ha `followVehicle?` (auto al seguito) + `extraMotoVehicles?` (moto aggiuntive). `ConfirmInstructorBooking(Batch)Input` accettano `followVehicleId?`/`extraMotoVehicleIds?`. `AutoscuolaSettings` ha `followCarRules` (mappa derivata dal flag globale, ora tutto-moto on/off). `StudentPhasePayload` (da `getMyPhase`) include `licenseCategory?`/`transmission?` (info).
- `regloApi.getVehicles` / `createVehicle({name, plate?, ...})` / `updateVehicle(id, {name?, plate?, status?, assignedInstructorId?, poolInstructorIds?, followsInstructorAvailability?})` / `deleteVehicle(id)`.
- `regloApi.getInstructors()` (owner picker only).
  - **Activation** = `updateVehicle(id, {status:'active'})`. **Deactivation** = `deleteVehicle(id)` (soft-delete = status inactive). This split is intentional — preserved from the original screens.
- Availability: `get/create/deleteAvailabilitySlots({ ownerType:'vehicle', ownerId })`, horizon `settings.availabilityWeeks` (`getAutoscuolaSettings`, default 4). Save = clear the day window then recreate if any day is selected (deselecting all clears availability).
- After any mutation the form calls `vehicleFormStore` `onChanged()` → the screen's `loadData()` reloads the list.

## Design (design-system §14 — Airbnb / mono-navy)
- Header = collapsible iOS large-title + BlurView (like `ClusterSettingsScreen`): `chevron-back` left, **`+` add right**.
- List = **flat rows** on the background (car-outline navy icon + name 600 + plate muted 400), hairline dividers. **Tap row → edit form**; `•••` → native ActionSheet (Attiva/Disattiva). No card-wrappers, no colored status badges.
- Inactive vehicles = dimmed row + "Inattivo" muted subtitle.
- Form = **page-sheet modal**, **X top-right**, scrollable body + pinned Salva footer (safe-area aware). Switched away from formSheet/content-hugging because the form overflowed and could not scroll. `ToggleSwitch` for active/inactive; day circles navy; time-cards open the `time-picker` route.
- Empty state = car icon in a white circle with soft shadow.

## Connected features
- **Availability Editor / Booking** — a vehicle's availability concurs to the bookable slots shown during booking.
- **Backend** — vehicles + availability-slots endpoints (see above).

## History
- Migrated from heavy cards + `BottomSheet` + `TimePickerDrawer` to flat list + formSheet routes (2026-06-09). Owner/Instructor unified into `VehiclesScreen`. Removed the per-row availability prefetch the Owner screen used to do (7 × N requests on load) — availability now only loads inside the edit form.
- **2026-06-24 redesign**: 1:1 fixed vehicle → M:N pool/esclusività + manutenzione; `vehicle-form.tsx` got the segmented "Modalità di utilizzo" + pool chips + maintenance toggle (native Modal). Added read-only auto al seguito display across the instructor agenda. See the "Usage modes + auto al seguito" section.
