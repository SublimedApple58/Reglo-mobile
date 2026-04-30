# Settings

## What it does
Role-conditional settings screen + instructor cluster settings.

## Key files
- `src/screens/SettingsScreen.tsx` (72KB) — all-roles settings
- `src/screens/ClusterSettingsScreen.tsx` (41KB) — instructor cluster config

## Settings by role

**All roles:** account info, password change, notification reminder timing (120/60/30/20/15 min)

**Student:** payment profile, add/remove methods, auto-payments toggle

**Instructor:** autonomous mode, available durations (30/45/60/90/120), rounded hours, availability mode (default/publication)

**Owner:** availability weeks ahead (2/4/6/8/12), booking actors, instructor booking mode, swap enabled, company-wide cutoff, weekly booking limits

## Cluster settings (ClusterSettingsScreen)
- Booking duration options
- Booking cutoff time
- Weekly booking limit
- Weekly absence toggle
- Restricted time range (no-booking window)
- Booking actor governance (students/instructors/both)
- Student assignment to cluster

## API functions used
`getAutoscuolaSettings`, `getInstructorSettings`, `updateInstructorSettings`, `getPaymentProfile`, `createSetupIntent`, `confirmPaymentMethod`, `removePaymentMethod`, `deleteAccount`

## Components used
Screen, Card, Button, Input, SelectableChip, TimePickerDrawer, BottomSheet

## Connected features
- **Availability Editor** — availabilityMode toggle
- **Payments** — payment method management
- **Booking Flow** — governance settings affect booking
- **Instructor Manage** — cluster config shared with ClusterSettingsScreen
