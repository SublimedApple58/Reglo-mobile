# Swaps

## What it does
Browse and accept peer-to-peer appointment swap offers.

## Access / navigation
**Not a tab.** Reachable only from the student home: the "Scambi" CTA card pushes
`/(tabs)/home/swaps` (a screen in the home stack, `app/(tabs)/home/swaps.tsx`).
The screen renders its own sticky blur header with a back arrow (`router.back()`).
There is no longer a `swaps` entry in `app/(tabs)/_layout.tsx`.

## Key files
- `app/(tabs)/home/swaps.tsx` — route (guards STUDENT + `useSwapEnabled`)
- `app/(tabs)/home/swap-detail.tsx` — formSheet detail (accept OR revoke), driven by `swapDetailStore`
- `src/stores/swapDetailStore.ts` — offer + `mine` + `onAccept`/`onRevoke`
- `src/screens/SwapOffersScreen.tsx` — blur-header list, two sections
- `src/screens/AllievoHomeScreen.tsx` — home swap marker on hero/mini cards
- `app/(tabs)/home/lesson-detail.tsx` — "Sostituzione richiesta" banner + revoke CTA
- `src/components/NotificationOverlay.tsx` — swap intent handling

## Features
- **Two sections**: "Le tue richieste" (own active offers, pink-accented card, "In attesa" badge) + "Disponibili dai compagni" (peers).
- Accept peer offer → celebration (variant: 'swap'); revoke own offer → `cancelSwapOffer`.
- Detail is a `formSheet` (`fitToContents`) via `swapDetailStore` + callback (back then act after 350ms), like `lesson-detail`.
- **Home markers**: a lesson with an active own swap request shows a pink "Sostituzione richiesta" chip (hero) / corner badge + label (mini-card); the guide detail shows a banner + "Revoca richiesta" instead of "Cerca sostituto". Driven by `getMySwapOffers` → `mySwapByAppointment` Map (appointmentId→offerId).
- 30-second polling for new offers + push-intent refresh.
- Feature-gated: `useSwapEnabled()` hook.
- **Non-swappable types** (fix 2026-06-12): `AllievoHomeScreen.openLessonDetail` sets `canSwap: false` for group-lesson seats (`groupLessonId`/`type group_lesson`) and `esame` — the BE rejects them too (Robatto incident: a swap takeover let a non-opted-in student into a group lesson).

## API functions used
`getSwapOffers`, `getMySwapOffers`, `respondSwapOffer`, `cancelSwapOffer`, `createSwapOffer`, `getStudents`

## Components used
BookingCelebration, ToastNotice (+ native Modal page sheet, BlurView header).
No longer uses Screen / BottomSheet / Button.

## Connected features
- **Notifications** — swap offers arrive via push → NotificationOverlay
- **Booking Flow** — accepted swap changes student's schedule
- **Settings** — swap enabled flag from company settings
