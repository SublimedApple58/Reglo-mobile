# Instructor Hours (Ore di guida)

## What it does
Read-only report of an instructor's completed driving hours over a **chosen period** (Airbnb-style selector), reached from "Altro" → Ore di guida (`(tabs)/more/instructor-hours`). Highlights hours worked outside the configured working window.

## Key files
- `src/screens/InstructorHoursScreen.tsx` — the screen (header, period pill, Fluent hero, adaptive bar chart)
- `app/(tabs)/more/hours-period.tsx` — period picker **formSheet**: preset chips (Questa settimana / Questo mese / Ultimi 30 giorni) + a **range calendar** (tap start→end), driven by `hoursPeriodStore`
- `src/stores/hoursPeriodStore.ts` — `{ from, to, onApply }` for the picker
- `src/hooks/queries/useInstructorHours.ts` — cache-first react-query hook (`queryKeys.instructorHours`, 5min), keyed per `{from, to}`

## Data & API (full-stack — range based)
- `regloApi.getInstructorHoursRange({ from, to })` → `InstructorHoursRange[]` (we use `[0]`). ISO `from`/`to` inclusive.
- **Backend** (`reglo`): route `/api/autoscuole/instructor-hours` branches — `from`&`to` → `getInstructorDrivingHoursRange` (range shape); else legacy `weekStart`/`monthStart` (the web dashboard `InstructorHoursDashboard.tsx` still uses the legacy `weekly/monthly`). **Requires the reglo backend deployed/running** with the new action.
- `InstructorHoursRange`: `rangeStart`, `rangeEnd`, `granularity: 'day'|'week'`, `total {totalMinutes, outsideWorkingHoursMinutes, appointmentCount}`, `buckets[]`, `workingHoursStart/End`
- `InstructorHoursBucket`: `key`, `label`, `startDate`, `totalMinutes`, `outsideWorkingHoursMinutes`, `appointmentCount`
- **Granularity**: span ≤ 14 days → daily buckets; longer → Mon–Sun weekly buckets (computed server-side).
- Legacy `InstructorHoursEntry`/`getInstructorHours` types/method are kept (unused by this screen now; the web dashboard uses the legacy endpoint shape).

## Design (design-system aligned, Airbnb premium — minimal pink, Fluent-forward)
- Same structure as the other redesigned instructor screens: clean header (back + "Ore di guida", 24/600), off-white bg, uppercase muted section labels.
- The data cards (hero, chart) are **informative → INSET shadow** (`boxShadow inset`, design system §5.4) but on a **white** surface (`#FFFFFF`, per feedback — not the `#EEEDEB` of the global spec). Empty-state illustration circle keeps a soft outer shadow. The period pill is an interactive control (white + soft outer shadow).
- Big numbers use **fontWeight 700** (not 800 — toned down per feedback).
- **Hero** (period total): inset card with a **Fluent 3D clock** (`fluent-clock.png`, 64px) + big **navy** total + lessons count + period sub-label + a neutral grey "fuori orario" pill (moon icon). No gradient, no pink fill.
- **Adaptive bar chart**: **navy** bars (`#1A1A2E`) with a **pink** cap (`#EC4899`) only for the outside-hours portion (no yellow); today (day) / current-week (week) label bold navy; per-bar value shown only when ≤ 8 buckets; legend when outside-hours exist. Reanimated height-in.
- **Period selector**: a centered tappable pill (calendar icon + label + chevron-down) → opens the `hours-period` formSheet (navy-outline preset chips + range calendar; future days disabled; navy edges + light in-range band).
- Pink is reserved as a small accent (outside-hours bar cap + legend) + the picker's Applica CTA; everything else navy/neutral.
- **Empty / error state**: `fluent-clock.png` in a white circle with soft shadow.
- **Instant load**: cache-first hook — re-selecting an already-viewed period renders instantly; first load shows skeletons.

## Connected features
- **Settings / Cluster** — the working-hours window that defines "fuori orario" comes from instructor/company settings.
- **Backend** — `GET /api/autoscuole/instructor-hours`.
