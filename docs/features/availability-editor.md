# Availability Editor

## What it does
Instructor availability management. The mode (`default` vs `publication`) is chosen in **Settings** (`more/availability-mode`), NOT inside the Disponibilità screen. The shell shows a mode badge **only in publication mode** — default mode reads as the plain screen (no "Modalità predefinita" tag).

## Live tree (Expo Router)
`app/(tabs)/role/` is a stack:
- `role/index.tsx` — role dispatcher (Owner / Instructor / RoleHome)
- `role/availability-exception.tsx` — page-sheet (`presentation: 'modal'`) to add/edit/remove an exception
- `role/time-picker.tsx` — wheel time picker (formSheet, `timePickerStore`)

For instructors, `index` renders `InstructorAvailabilityScreen` (the shell).

## Key files
- `src/screens/InstructorAvailabilityScreen.tsx` — shell: collapsible BlurView large-title header ("Disponibilità"), mode badge, immediacy skeleton until the mode resolves, then renders the right editor with `FadeIn`. Pull-to-refresh bumps an `editorKey` to remount + refetch the active editor.
- `src/screens/DefaultAvailabilityEditor.tsx` — **default mode**: "Settimana tipo + Eccezioni".
- `src/screens/PublicationModeEditor.tsx` — **publication mode**: week-by-week.
- `src/components/RangesEditor.tsx` — shared time-range editor (navy clock circle).
- `src/components/MiniCalendar.tsx` — calendar (navy selected/today/dot).
- `src/stores/availabilityExceptionStore.ts` — binds the exception page-sheet to the live instructor context + `onSaved` refresh.

## Default mode — "Orari settimanali + Eccezioni" (Airbnb)
Airbnb-style: a single editorial column, lots of air, full-bleed hairline dividers, **one** Fluent 3D accent in the header and line icons (chevron/+) everywhere else. **Per-weekday hours are supported** end-to-end (full-stack): the backend `AutoscuolaWeeklyAvailability.rangesByDay` map persists a different schedule per day. `getDefaultAvailability` returns `scheduleByDay` (`Record<dayOfWeek, TimeRange[]>`, always present — legacy shared records are projected onto each active day server-side).
- **Orari settimanali**: vertical **7-day list** (Lun→Dom, value 1..6,0). Each row = full day name (left) + right-aligned **soft-shadow white time chips** per range, or muted grey "Non disponibile" + chevron. Tap a row → **`role/publish-day` formSheet** (reused via `publishDayStore`) to toggle that day on/off + edit its ranges (`RangesEditor`); the draft updates the local `schedule` only.
  - **Batch save**: a single dirty-only "Salva orari" (navy, `FadeIn`) appears when `schedule` differs from the last-saved snapshot (`savedRef` key over active days). → `createAvailabilitySlots({ scheduleByDay, startsAt/endsAt from a representative day, weeks })`. One server round-trip (slot regeneration is heavy) instead of per-day auto-save. New instructor (no base) → suggested Lun–Ven 09:00–18:00, reads as dirty.
  - Cache-first via `availabilityCache` `base` (now `{ scheduleByDay }`).
- **Eccezioni**: flat list of upcoming overrides (`getDailyAvailabilityOverrides`, future-only, sorted) — hairline dividers, no card, no Fluent (single-accent rule). Each row: short date (`Lun 9 giu`) + right-aligned **soft-shadow white time chips** per range, or muted grey "Assente" + chevron (no colored dots — no amber/yellow). Tap a row → edit/remove that date. "Aggiungi eccezione" = clean filled light button (no dashed) → page-sheet:
  - *Una volta* → MiniCalendar date → `setDailyAvailabilityOverride(date, ranges|[])`
  - *Ricorrente* → weekday + N settimane → `setRecurringAvailabilityOverride(dayOfWeek, ranges|[], weeksAhead)`
  - Edit existing → same sheet (date locked) + "Rimuovi eccezione" → `deleteDailyAvailabilityOverride`.
  - "Assente tutto il giorno" toggle = empty ranges.

## Publication mode UI (Airbnb-flat — greyscale)
No wrapping card, no colored tags/dots — flat rows + hairline dividers + typographic hierarchy.
- **Week pills**: chunky rounded **filled** pills (horizontal scroll, `WEEK_COUNT` = 8): **published = soft mint** (`#E9F9F0`) + green `checkmark-circle` (`#34C759`); **not published = light grey** (`#F1F2F4`); **selected = navy fill** (white text + white check). One `getPublishedWeeks(from,to)` call.
- **Action bar** (Airbnb footer-style, placed high under the pills): left = status only — `✓ Pubblicata` (green check) + "Visibile agli allievi", or `Da pubblicare` (hollow grey circle) + "Non ancora visibile agli allievi" (no day/hour counts); right = a **compact rounded button** "Pubblica" (navy) / "Ritira" (ghost outline) → `publishWeek` / `unpublishWeek`. No full-width bottom CTA.
- **Day list**: clean flat rows (no card, no per-row control), full-width hairline dividers. Each row: `Lun 1` (dark) + optional grey "Oggi" + right-aligned hours as **soft-shadow white chips** (`11:00–18:00`, one per range, wrap) or "Riposo" (light grey) + chevron. State is read from the row itself — no switch/checkbox cluttering the column.
  - **Swipe left to toggle** the day on/off (custom `Gesture.Pan` + reanimated in `SwipeRow`, built from scratch — not the shared `ReanimatedSwipeable`). Past `SWIPE_THRESHOLD` the release commits: reveals a slate "Riposo" action (disable) or green "Attiva" action (enable). Optimistic via `setDailyAvailabilityOverride`; keeps ranges so re-enabling restores them. The shell root is a `GestureHandlerRootView`.
  - **Tap the row** → **`role/publish-day` formSheet** (`publishDayStore`) to edit the times (`RangesEditor`).
- Pre-fill from last published week. Skeleton day-rows on week change; `FadeIn(220)` on week switch.

### RangesEditor (shared, Airbnb-style)
Each range = two tappable **Inizio / Fine** cards (white, soft shadow — they're CTAs) showing a small uppercase label + large time; tap opens the time picker. `×` removes a range (when >1). "Aggiungi fascia" = a filled light button (subtle border, no dashed). Used by `publish-day` (both publication per-date and default per-weekday) and `availability-exception`.

## Immediacy / loading
Shell + section chrome render instantly; small `SkeletonBlock`s sit where data will land and are replaced with `FadeIn(400)`. No full-screen `SkeletonCard` / centered `ActivityIndicator`.

### On-device cache (`src/services/availabilityCache.ts`, AsyncStorage)
Cache-first paint, then background refresh — removes the staged "wait → rail → wait → days" cold-load:
- `mode` (mode + weeks) → the shell renders the right editor instantly without waiting on `getInstructorSettings`.
- `pubweeks` (published-weeks horizon) → rail dots instant.
- `week:{weekStart}` (publication `DayState[]`) → the selected week's day list instant; refetched silently and re-cached.
- `base` (default-mode per-weekday schedule, `{ scheduleByDay }`) → "Orari settimanali" instant.

### Optimistic day save (publication)
Saving a single day from the `publish-day` sheet is **instant**: local state + cache update synchronously, the `setDailyAvailabilityOverride` call is fire-and-forget (revert + toast on failure). No per-day spinner. Only `publishWeek` / `unpublishWeek` show a loading state.

## Colors (design system)
Navy `#1A1A2E` for active/selection + all CTAs. Pink only as micro-accent (publication "today" dot). No yellow.

## API functions used
`getDefaultAvailability` (returns `scheduleByDay`), `getDailyAvailabilityOverrides`, `setDailyAvailabilityOverride`, `deleteDailyAvailabilityOverride`, `setRecurringAvailabilityOverride`, `createAvailabilitySlots` (accepts `scheduleByDay`), `publishWeek`, `unpublishWeek`, `getPublishedWeeks`.

### Per-weekday base (full-stack)
The default mode persists **different hours per weekday** via the backend `AutoscuolaWeeklyAvailability.rangesByDay` JSON map (see `reglo/docs/features/availability.md` → "Per-weekday base schedule"). Mobile contract: `CreateAvailabilitySlotsInput.scheduleByDay?: Record<number, TimeRange[]>` and `DefaultAvailability.scheduleByDay` in `src/types/regloApi.ts`. Legacy shared records keep working (projected onto each active day).

## Legacy (not mounted)
`src/screens/InstructorManageScreen.tsx` + its exported `AvailabilityEditor` (3-tab Predefinito/Calendario/Ricorrente) are only reachable via the unused React-Navigation `TabNavigator`. The Expo Router app does not use them.

## Connected features
- **Booking Flow** — published/override availability determines bookable slots
- **Settings** — `availabilityMode` toggle lives in `more/availability-mode`
