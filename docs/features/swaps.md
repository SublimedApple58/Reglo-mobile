# Swaps

## What it does
Browse and accept peer-to-peer appointment swap offers.

## Key files
- `src/screens/SwapOffersScreen.tsx` (15KB)
- `src/components/NotificationOverlay.tsx` — swap intent handling

## Features
- Browse swap offers from other students
- Accept with celebration animation (variant: 'swap')
- 15-second polling for new offers (highest frequency in app)
- View accepted swaps history
- Feature-gated: `useSwapEnabled()` hook

## API functions used
`getSwapOffers`, `respondSwapOffer`, `getMyAcceptedSwaps`, `getStudents`

## Components used
Screen, BottomSheet, Button, BookingCelebration

## Connected features
- **Notifications** — swap offers arrive via push → NotificationOverlay
- **Booking Flow** — accepted swap changes student's schedule
- **Settings** — swap enabled flag from company settings
