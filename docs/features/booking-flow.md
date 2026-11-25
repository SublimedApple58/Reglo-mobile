# Booking Flow

## What it does
Student lesson booking: select type/duration → pick date → view available slots → confirm → momento di conferma (REG-790) nel foglio «Orari».

## Key files
- `src/screens/AllievoHomeScreen.tsx` (119KB) — main booking UI
- `src/components/BookingConfirmed.tsx` — REG-790: conferma (video STOP → OK, «Prenotata!», riepilogo, «Fatto» / «Vedi la guida»)
- `src/stores/bookingConfirmedStore.ts` — la guida appena presa (variant `booked` | `swap`)
- `assets/conferma/stop-ok.mp4` + `stop-ok-primo.png` — video (2,4 s, 396 px, 78 KB) e poster

## Flow
1. `getBookingOptions()` → lesson types, durations per cluster
2. `getAvailableSlots(date, duration)` → available time slots
3. `createBookingRequest(slot)` → book lesson
4. On `matched: true`: `loadConfirmedLesson` (guida con istruttore/auto/sede) + `invalidateAllData()`, haptic success, `bookingConfirmedStore.set({ variant: 'booked' })`: il foglio `booking-slots` NON si chiude, diventa la conferma (dissolvenza `contentKey`). «Fatto», X o gesto → `dismissTo('/(tabs)/home')`; «Vedi la guida» → chiude e apre `lesson-detail` (`openLessonDetailRef`).

## Conferma (REG-790, Tiziano 25/11/2026)
- Protagonista: cartello STOP 3D che gira sul palo e si ferma sulla faccia verde con la spunta (video Veo, `expo-av` `Video`: una riproduzione, muto, fermo sull'ultimo fotogramma, primo fotogramma come poster; sfondo bianco puro = Y 235 in limited range, si fonde col foglio). `expo-av` e non `expo-video` perché è già nella build nativa → si rilascia in OTA.
- «Prenotata!» (o «La guida è tua!» da Scambi), giorno · orario, righe istruttore · auto (se veicoli attivi) · sede, nota piccola (promemoria; soglia senza penale solo se la guida ha `penaltyCutoffAt`).
- Non esiste una prenotazione allievo «in attesa dell'autoscuola»: il server crea la guida `scheduled` subito (`autoscuole-availability.actions.ts`), `matched: false` = orario preso → errore. Niente variante «in attesa».
- Scambi: `StudentSwapsScreen` (e la vecchia `SwapOffersScreen`) dopo `respondSwapOffer` accettato aprono il foglio `swaps/booking-confirmed` (`home/booking-confirmed`); «Vedi la guida» → tab Guide via `openLessonRequestStore`.
- Tolto `BookingCelebration` (overlay con scintille + toast «La guida è tua!»).

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

## Luogo dello slot (REG-705e)
Con «Disponibilità per luogo» accesa `AvailableSlot` porta `locationId` + `locationName`
e alla stessa ora possono esserci più slot (uno per luogo). L'identità di uno slot è
`slotKey` / `isSameSlot` (`src/utils/slotLocation.ts`: ora + luogo), non più solo
`startsAt`; ogni `createBookingRequest` (booking-slots, scelta libera, foglio
«Orari disponibili» di `NotificationOverlay`) aggiunge `slotLocationParam(slot)`.
Spenta la funzione la richiesta è identica a prima.

UI (anteprime approvate da Tiziano il 04/11): `slotLocationMode(slots)` decide come
mostrare il luogo. `single` (tutti allo stesso luogo) → il nome va una volta sola
nel sottotitolo, accanto a giorno e durata; `multi` → riga discreta «pin + luogo»
sotto l'orario di ogni slot (in `booking-slots` anche `· Nome` dell'istruttore se
lo slot lo porta) e bottone «Prenota a <luogo>»; `none` → come prima. Vale per
`booking-slots.tsx` e per il foglio «Orari disponibili» di `NotificationOverlay`.

Home allievo (stessa approvazione): niente pillole né chip. Il countdown della
prossima guida è testo semplice; sotto, righe discrete: luogo (nome + indirizzo in
grigio), istruttore `· tipo guida · tipo moto`, oppure «Sostituzione richiesta».
Card piccole bianche (via i colori a rotazione e il badge scambio), con la riga
del luogo. La patente è testo dopo il nome dell'autoscuola, e nell'header
compatto non c'è più il tag «Pratica». «Le tue guide» (`LessonsOverview`): sottotitolo
`<luogo> · <istruttore>` quando la guida ha un luogo.

## API functions used
`getBookingOptions`, `getAvailableSlots`, `getDateAvailability`, `createBookingRequest`, `getAppointments`

## Components used
Screen, BottomSheet, CalendarDrawer, CalendarNavigatorRange, Card, Badge, BookingConfirmed

## Connected features
- **Notifications** — booking success can trigger proposal/confirmation
- **Settings** — booking governance (limits, cutoff, actors) configured in settings
- **Backend** — `docs/features/booking-engine.md` in `../reglo/`

## Intestazione della home (11/11/2026)

In alto a destra solo la campanella (`home-bell`). Tolto il volto dell'allievo: apriva la tab «Altro» (`/(tabs)/more`), nascosta all'allievo, e lasciava la barra senza voce selezionata. Profilo, impostazioni ed «Esci» restano nella tab Profilo (`SettingsScreen`).

## Crediti per prenotare (REG-784, 24/11/2026)

Con «Servono crediti per prenotare» acceso il server blocca l'allievo che non ha crediti per la guida (`LESSON_CREDITS_REQUIRED`, con `lessonCreditsData.title` «Crediti finiti» / «Mancano 30 minuti»).

- **Home allievo** (gerarchia a tre livelli, `student-booking-exceptions.md`): se `bookingOptions.lessonCredits.insufficient` niente prenotazione; senza guide i crediti sono la card grande (`CreditsPrimaryCard`), con la prossima guida scendono a card piccola (`HomeSmallCard`), sotto l'esame a riga dentro la card della guida. Salvadanaio ambra `PiggyCoin` (`src/components/credits/CreditsHero.tsx`): la moneta cade nella fessura all'ingresso (260 + 320 ms, senza rimbalzo, mai spenta da «Riduci movimento»). Con crediti ok «Prenota» mostra il saldo («Hai 4 guide di credito»).
- **Foglio `home/credits-needed`**: si apre dagli errori `LESSON_CREDITS_REQUIRED` di prenotazione (home), posti liberati e ultimo minuto (`router.replace`) e scambi (`push`). Parametri da `lessonCreditsSheetParams` (`src/utils/lessonCreditsError.ts`).
- **Staff** (`BookingForm`): `LESSON_CREDITS_CONFIRM` è un codice confermabile (`confirmLessonCredits`), avviso nativo col titolo del server («Vittoria non ha crediti») e «La guida resterà da pagare.».
- Asset: `assets/vita/salvadanaio-ambra*.png`, `moneta*.png` (`VITA_ART`).
