# Availability Editor

## What it does
Instructor availability management with three modes: default weekly, daily overrides, and publication mode.

## Key files
- `src/screens/InstructorAvailabilityScreen.tsx` (5KB) — mode dispatcher
- `src/screens/PublicationModeEditor.tsx` (22KB) — week-by-week publication
- `src/components/RangesEditor.tsx` — shared time range editor

## Modes
- `availabilityMode === "default"` → three-tab editor (Predefinito, Calendario, Ricorrente)
- `availabilityMode === "publication"` → `PublicationModeEditor`

## PublicationModeEditor UI
- Horizontal day strip (7 pills: pink = available, gray = off, yellow border = selected)
- Detail panel for selected day: toggle + RangesEditor
- Week navigation with arrows
- Publish/unpublish with badge (green/orange)
- Pre-fill from last published week
- Incremental save: changes save immediately via `setDailyAvailabilityOverride`

## API functions used
`getDefaultAvailability`, `getDailyAvailabilityOverrides`, `setDailyAvailabilityOverride`, `deleteDailyAvailabilityOverride`, `setRecurringAvailabilityOverride`, `publishWeek`, `unpublishWeek`, `getPublishedWeeks`, `createAvailabilitySlots`, `deleteAvailabilitySlots`

## Components used
Screen, Badge, Button, RangesEditor, TimePickerDrawer, Skeleton

## Connected features
- **Booking Flow** — published availability determines bookable slots
- **Settings** — availabilityMode toggle lives in SettingsScreen
- **Instructor Manage** — InstructorManageScreen also shows daily overrides (MiniCalendar)
