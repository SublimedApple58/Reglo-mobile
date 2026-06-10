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

## Fixed vehicle per instructor (2026-06-09)
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
- Type `AutoscuolaVehicle` (`name`, `plate`, `status`, `assignedInstructorId`, `followsInstructorAvailability`, `licenseCategory`, `transmission`). `CreateVehicleInput`/`UpdateVehicleInput` accettano `licenseCategory?`/`transmission?`. `StudentPhasePayload` (da `getMyPhase`) include `licenseCategory?`/`transmission?` (info).
- `regloApi.getVehicles` / `createVehicle({name, plate?})` / `updateVehicle(id, {name?, plate?, status?, assignedInstructorId?, followsInstructorAvailability?})` / `deleteVehicle(id)`.
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
