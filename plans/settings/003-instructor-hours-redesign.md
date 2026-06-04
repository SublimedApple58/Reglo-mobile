# Ore di guida (Instructor Hours) — Redesign + instant load

## What was done
Full redesign of the "Ore di guida" screen (Altro → Ore di guida), cache-first loading, Airbnb-premium look consistent with the other redesigned instructor/allievo screens.

## User directives
- Redo the whole structure; Airbnb style (shadows, elegant gradients).
- Same structure as the screens already redone (allievo + instructor).
- "Fuori orario" treatment: my call, Airbnb style (no yellow).

## Changes
1. **`src/hooks/queries/queryKeys.ts`** — `STALE_TIMES.instructorHours` (5min) + `queryKeys.instructorHours(companyId, {weekStart, monthStart})`.
2. **`src/hooks/queries/useInstructorHours.ts`** (NEW) — cache-first query hook, keyed per week.
3. **`src/screens/InstructorHoursScreen.tsx`** — rewrite:
   - Clean header (back + title 24/600), off-white bg; white pill week selector (forward disabled on current week).
   - Gradient hero (`#EC4899`→`#BE185D`, radius 26, soft pink shadow): weekly total + lessons count + discreet "fuori orario" pill.
   - Daily bar chart: pink bars with darker cap (`#9D174D`) for the outside-hours portion (replaces amber `#FACC15`), today highlighted, legend; reanimated height-in.
   - Monthly card (pink-tint icon + total, outside as muted sub-line — no amber `#A16207`).
   - `fluent-clock` empty/error state; skeletons on cold load only.
   - Uses `useInstructorHours` (was raw `getInstructorHours` + full blocking skeleton). Dropped `Card`/`SectionHeader` legacy components.
4. Docs: new `features/instructor-hours.md`, INDEX + impact-map updated.

## Amendment 2 — Airbnb period selector (full-stack)
User: replace the week stepper with an Airbnb-style period chooser (preset + custom range).
- **Backend (`reglo`)**: new `getInstructorDrivingHoursRange({ from, to })` action + types `InstructorHoursRange`/`InstructorHoursBucket` (legacy `getInstructorDrivingHours` + web dashboard untouched). Route branches on `from`&`to`. Granularity: ≤14d daily, else Mon–Sun weekly. **No migration.** New doc `reglo/docs/features/instructor-hours.md` + INDEX.
- **Mobile**: range types + `regloApi.getInstructorHoursRange`; `useInstructorHours(from, to)`; `hoursPeriodStore` + `app/(tabs)/more/hours-period.tsx` formSheet (preset chips + custom range calendar, future disabled); screen now has a period pill → picker, adaptive bucket chart (day/week), hero = period total. Removed the monthly card + week stepper.
- ⚠️ **Needs the reglo backend deployed/running** with the new action, else the mobile range call 400s.

## Verify
- tsc clean (only pre-existing TabNavigator error).
- No yellow (badge/bars/month text all retoned).
- Instant on re-viewing a week (cache); skeletons on first load of a new week.
- Forward week nav blocked at current week.
