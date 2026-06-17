# Booking Flow

## What it does
Student lesson booking: select type/duration → pick date → view available slots → confirm → celebration animation.

## Key files
- `src/screens/AllievoHomeScreen.tsx` (119KB) — main booking UI
- `src/components/BookingCelebration.tsx` — confetti animation on success

## Flow
1. `getBookingOptions()` → lesson types, durations per cluster
2. `getAvailableSlots(date, duration)` → available time slots
3. `createBookingRequest(slot)` → book lesson
4. `BookingCelebration` plays (variant: 'booking')

## Optimistic update (no flicker)
The just-booked lesson is held in an **optimistic overlay** (`optimisticAppts` state in
`AllievoHomeScreen`), NOT in the React Query cache. The derived `appointments` list merges
the overlay on top of `useAppointments` data. This is deliberate: background refetches (the
focus refetch fired when the booking sheets `router.dismiss(2)`, the 2-min staleTime,
pull-to-refresh) overwrite the cache, so a cache-only optimistic row gets yanked out before
the Neon read path catches up — that caused an "appears → disappears → reappears" ping-pong.
- On confirm: `addOptimisticAppt(provisionalAppt)` (temp `provisional-…` id).
- On `matched: true`: `replaceOptimisticAppt` adopts the **real** `response.appointment`
  (server id + fields, relations preserved) so tap/cancel work immediately, then a single
  delayed `invalidateAllData()` (2.5s) reconciles in the background.
- On error / `matched: false`: `removeOptimisticAppt`.
- Overlay self-prunes when the server list returns the real id, or after a 30s safety expiry.
- `executeCancel` also calls `removeOptimisticAppt` so cancelling an overlay-only lesson hides
  it instantly (self-healing if the cancel fails: `onSettled` refetch restores it).

Note: `handleBookingConfirm` and `handleConfirmFreeChoiceSlot` are currently **dead code**
(defined, never wired) and still use the old `setQueriesData` cache pattern — `onConfirmBooking`
is the only live path.

## API functions used
`getBookingOptions`, `getAvailableSlots`, `getDateAvailability`, `createBookingRequest`, `getAppointments`

## Components used
Screen, BottomSheet, CalendarDrawer, CalendarNavigatorRange, Card, Badge, BookingCelebration

## Connected features
- **Notifications** — booking success can trigger proposal/confirmation
- **Settings** — booking governance (limits, cutoff, actors) configured in settings
- **Backend** — `docs/features/booking-engine.md` in `../reglo/`
