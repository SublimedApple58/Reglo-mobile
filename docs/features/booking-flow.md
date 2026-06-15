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

## API functions used
`getBookingOptions`, `getAvailableSlots`, `getDateAvailability`, `createBookingRequest`, `getAppointments`

## Components used
Screen, BottomSheet, CalendarDrawer, CalendarNavigatorRange, Card, Badge, BookingCelebration

## Connected features
- **Notifications** — booking success can trigger proposal/confirmation
- **Settings** — booking governance (limits, cutoff, actors) configured in settings
- **Backend** — `docs/features/booking-engine.md` in `../reglo/`
