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

## Error surfacing (2026-07-28, caso Robatto)
- `onSearchSlots` non fallisce mai in silenzio: un 400 gestito dal backend
  (blocco prenotazioni, cutoff, …) o un errore di rete finisce in
  `bookingFlowStore.searchError` e viene mostrato in rosso sopra la CTA del
  foglio `booking-flow.tsx` (si pulisce al cambio giorno / nuova ricerca).
- `getBookingOptions` espone `bookingBlocked` (blocco manuale del titolare o
  auto-block per debito, vedi `../reglo/docs/features/auto-booking-block-debt.md`):
  se `true`, `openBookingFlow` mostra il toast "Le tue prenotazioni sono
  temporaneamente sospese. Contatta la segreteria." e non apre il foglio.
  Backward-compatible: campo assente (backend vecchio) = non bloccato.

## Luogo dello slot (REG-705e, dati)
Con «Disponibilità per luogo» accesa `AvailableSlot` porta `locationId` + `locationName`
e alla stessa ora possono esserci più slot (uno per luogo). L'identità di uno slot è
`slotKey` / `isSameSlot` (`src/utils/slotLocation.ts`: ora + luogo), non più solo
`startsAt`; ogni `createBookingRequest` (booking-slots, scelta libera, foglio
«Orari disponibili» di `NotificationOverlay`) aggiunge `slotLocationParam(slot)`.
Spenta la funzione la richiesta è identica a prima. La UI con il nome del luogo
aspetta l'ok sulle anteprime 705-e.

## API functions used
`getBookingOptions`, `getAvailableSlots`, `getDateAvailability`, `createBookingRequest`, `getAppointments`

## Components used
Screen, BottomSheet, CalendarDrawer, CalendarNavigatorRange, Card, Badge, BookingCelebration

## Connected features
- **Notifications** — booking success can trigger proposal/confirmation
- **Settings** — booking governance (limits, cutoff, actors) configured in settings
- **Backend** — `docs/features/booking-engine.md` in `../reglo/`
