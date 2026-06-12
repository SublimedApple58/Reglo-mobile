# Settings

## What it does
Role-conditional settings screen + instructor cluster settings.

## Key files
- `src/screens/SettingsScreen.tsx` — all-roles settings (`renderStudentContent` + `renderNonStudentContent`)
- `src/screens/ClusterSettingsScreen.tsx` — instructor cluster config ("Il mio gruppo")
- `app/(tabs)/settings/profile-edit.tsx` — profile-edit formSheet (student, settings tab)
- `app/(tabs)/more/profile-edit.tsx` — profile-edit formSheet (instructor/owner, "Altro" stack; bound to `settingsStore`)
- `app/(tabs)/more/agenda-view.tsx` — Vista agenda formSheet (day/week)
- `app/(tabs)/more/availability-mode.tsx` — Disponibilità mode formSheet (default/publication, local select → "Salva" persists)
- `app/(tabs)/more/agenda-settings.tsx` — Agenda formSheet (owner: weeks + reminders)
- `src/stores/instructorSettingsStore.ts` — publishes instructor/owner setting values + handlers to those sub-pages

## Design (design-system aligned)
The instructor/owner branch (`renderNonStudentContent`): large title, then directly the settings. **The profile card was MOVED to the "Altro" screen (`MoreScreen`)** to avoid duplication between Altro and Impostazioni — it is no longer rendered here (it still opens `more/profile-edit`, now tapped from the Altro hero card). Every setting is a **normal `menuGroup` row** (icon + label + current-value hint + chevron) that opens a **formSheet sub-page** in the "Altro" stack — Vista agenda → `more/agenda-view`, Disponibilità → `more/availability-mode`, Agenda (owner) → `more/agenda-settings`, plus Notifiche; then the account group (Esci / Elimina account). No inline control cards. `SelectableChip` is outline navy globally; selection in the sub-pages = navy radio/check; pink reserved for CTAs. Profile fields are published to `settingsStore` for all roles; instructor/owner setting values to `instructorSettingsStore`. **No yellow anywhere**: `SelectableChip` is now **outline navy** globally (`#1A1A2E`), the agenda segmented control is outline navy, and Switch tracks use pink (not `#FACC15`). Pink reserved for CTAs only. The profile fields are published to `settingsStore` for **all roles** (was student-only) so `more/profile-edit` can bind to them.

## Settings by role

**All roles:** account info, password change, notification reminder timing (120/60/30/20/15 min)

**Student:** payment profile, add/remove methods, auto-payments toggle

**Instructor:** autonomous mode, available durations (30/45/60/90/120), rounded hours, availability mode (default/publication)

**Owner:** availability weeks ahead (2/4/6/8/12), booking actors, instructor booking mode, swap enabled, company-wide cutoff, weekly booking limits

## Cluster settings (ClusterSettingsScreen — "Il mio gruppo")
- Booking duration options, cutoff time, weekly limit, weekly absence, restricted time range, booking actor governance, student assignment to cluster.
- **Codice di invito**: card sotto il menu (solo se `autonomousMode`, da `getInstructorSettings().inviteCode`) — codice 6 char in monospace grande, tap = copia (usa `Clipboard` da `react-native` core, deprecato ma OTA-safe: `expo-clipboard` NON è nel binario; migrare alla prossima build nativa) + haptic + toast. Un allievo che si registra con quel codice (`SignupScreen` campo "Codice di invito") entra direttamente nel gruppo dell'istruttore (BE: lookup company-first, vedi `reglo/docs/features/instructor-clusters.md`).
- **Design-system aligned**: Switch tracks are **pink** (`#EC4899`, was yellow `#FACC15`); palette `#1A1A2E` (was slate `#1E293B`); `SelectableChip` navy.
- **Migrated off custom drawers**: the 3 `TimePickerDrawer`s → **formSheet route** `app/(tabs)/notes/time-picker.tsx` (shared `timePickerStore`); the students-management `BottomSheet` → **page-sheet route** `app/(tabs)/notes/group-students.tsx` (`groupStudentsStore`). Notes layout got `contentStyle` background + the two route registrations.

## Performance — instant render (non-blocking load)
The screen never blocks on network. `initialLoading` is set `false` as soon as the session-derived UI can render; the network calls that only feed **row hints** run in the **background, in parallel**, gated by a separate loading flag that shows a small `SkeletonBlock` on just that row.
- **Student:** profile card + payment render immediately; `loadStudentAvailabilityPreset` runs in background, `availabilityLoading` gates only the Disponibilità hint.
- **Instructor/Owner:** profile card + Vista agenda (from `sessionStorage`) render immediately; `getAutoscuolaSettings` + `getInstructorSettings` run in parallel in the background, `settingsLoading` gates only the Disponibilità mode + Agenda weeks hints. (Previously these were two sequential awaits blocking the whole screen behind a full skeleton.)

## API functions used
`getAutoscuolaSettings`, `getInstructorSettings`, `updateInstructorSettings`, `getPaymentProfile`, `createSetupIntent`, `confirmPaymentMethod`, `removePaymentMethod`, `deleteAccount`

## Components used
Screen, Card, Button, Input, SelectableChip, TimePickerDrawer, BottomSheet

## Connected features
- **Availability Editor** — availabilityMode toggle
- **Payments** — payment method management
- **Booking Flow** — governance settings affect booking
- **Instructor Manage** — cluster config shared with ClusterSettingsScreen
