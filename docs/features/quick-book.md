# Quick-book (prenotazione veloce istruttore)

Prenotazione/blocco rapido dalla home istruttore tramite gesture sulla timeline
(tieni-premuto-e-scorri su una fascia libera; sia in vista giorno sia nel giorno
**espanso** della vista settimana — stesso `BookableBand`).
Apre un **page sheet nativo** con una **segmented control "Airbnb"** che alterna
**Prenota guida** ⇄ **Blocca slot**, con i form **identici** alle modali dedicate
(`new-booking` / `block-slot`) e Giorno+Ora pre-compilati dalla gesture.

## Architettura

I form delle due modali dedicate sono estratti in **componenti condivisi**, riusati
sia dalle route standalone sia dal quick-book (embedded). Un solo source of truth ⇒
i form quick sono identici a quelli pieni per costruzione.

| File | Ruolo |
|------|-------|
| `src/components/booking/BookingForm.tsx` | Form completo "Nuova prenotazione" (allievo, multipla, giorno/ora/durata, luogo, veicolo, tipo). Prop `embedded` nasconde topbar/hero. Legge `bookingSheetStore`. |
| `src/components/booking/BlockForm.tsx` | Form completo "Blocca slot" (giorno, ora inizio/fine, motivo, ripeti settimane). Prop `embedded` nasconde header. Legge `blockSheetStore`. |
| `app/(tabs)/home/new-booking.tsx` | Route standalone (FAB) → `<BookingForm />`. `presentation: 'modal'`. |
| `app/(tabs)/home/block-slot.tsx` | Route standalone (FAB) → `<BlockForm />`. `presentation: 'formSheet'` fitToContents. |
| `app/(tabs)/home/quick-book.tsx` | Sheet quick-book: topbar (X + segmented Airbnb) + `<BookingForm embedded />` / `<BlockForm embedded />`. **`PAGE_SHEET`** (2026-07-02: era formSheet fitToContents, ma il form moto superava lo schermo e su iOS non scrollava) — full height, body in ScrollView, footer pinnato. |
| `src/utils/lastBookingSelection.ts` | Memoria per-istruttore (AsyncStorage) dell'ultimo veicolo/auto al seguito **selezionati prenotando** (≠ ultimo veicolo usato). Salvata da `BookingForm` a prenotazione riuscita; riletta all'apertura per preimpostare i picker. |
| `src/stores/bookingSheetStore.ts` | Dati booking + callback optimistic. Campo `presetStartMinutes?` (quick-book). |
| `src/stores/blockSheetStore.ts` | Dati block + callback optimistic. Campo `presetStartMinutes?` (quick-book). |

## Flusso

1. **Gesture** in `IstruttoreHomeScreen`:
   - Day view: `<BookableBand onPick={(min) => openQuickBookSheet(...)} />` (banda fantasma + hold-to-scrub; vedi "Timeline giorno").
   - Week view: `WeeklyOverview` → tap su un giorno lo espande nell'itinerario → `<BookableBand onPick={(min) => openQuickBookSheet(date, ...)} />` con la **data del giorno espanso** (stessa gesture della vista giorno).
   - **Grid view** (`WeeklyAgendaView`): **blocco fantasma** (2026-06-12, sostituisce lo scrub) — hold (220ms) su spazio libero genera un blocco draft da 1h che si trascina live (15' step verticali, cross-colonna orizzontale); release lo piazza → knob alto/basso per la durata (30'–4h) + CTA bottom "Scegli i dettagli". Tap su spazio libero = piazza il blocco lì (o dismisses quello esistente). Il blocco piazzato si ri-trascina con hold (160ms). Posizione/size su shared values (UI thread, zero re-render); label via mini pub/sub `ghostTimeLabel`/`ghostDurLabel`; bolla finger = la solita `ScrubBubble` (label = range). CTA conferma → `onBookAt(date, start, start, start+dur, dur)`. `onGhostActiveChange` nasconde il FAB della home mentre la CTA è visibile. Dismiss: ✕, conferma, swipe settimana, tap fuori, unmount.
   - Empty-day CTA: bottone "Prenota una guida" → `openQuickBookSheet(...)`.
2. `openQuickBookSheet(date, startMinutes, windowStart, windowEnd, durationMinutes?)` calcola il preset
   clampato; la durata del blocco fantasma (step liberi da 15') viene **snappata alla
   durata consentita più vicina** e passata come `presetDurationMinutes` →
   `seedBookingStore(date, preset, presetDur)` la usa come `defaultDuration`.
   Poi semina anche `seedBlockStore(date, preset)` e fa
   `router.push('/(tabs)/home/quick-book')`.
3. La route renderizza il form scelto dalla segmented; il **parent (home) possiede la
   logica optimistic** (insert/replace/reconcile/remove) tramite le callback degli store
   — nessuna duplicazione di logica weekly-limit / recurring.

## Timeline giorno (rail itinerario)

La day view di `IstruttoreHomeScreen` costruisce **una sola sequenza ordinata**
(`seq`) che mischia: marker disponibilità, righe prenotate (`ItinRow`) e fasce
libere (`freeRows` → `BookableBand`). Ogni elemento ha `sortMin` + `order`
(start-marker 0 · contenuto 1 · end-marker 2) e si ordina per minuto, poi `order`.

- **Marker per finestra**: gli slot di disponibilità grezzi vengono mergiati in
  `windows` (fasce contigue). Per **ogni** finestra si emette un marker inizio e
  uno fine. Più fasce in un giorno (es. 09–13 + 15–20) ⇒ `Inizio disponibilità`
  → `Pausa` (fine 1ª fascia) → `Ripresa disponibilità` (inizio 2ª) →
  `Fine disponibilità`. Il **gap** tra fasce è quindi esplicito, non più invisibile.
- **Fuori disponibilità**: una guida oltre la fine fascia (es. 19:00 con fascia
  fino alle 18:00) ha `sortMin` > end-marker ⇒ si ordina **sotto** `Fine
  disponibilità`, non più sopra (era il bug del marker sempre renderizzato per ultimo).
- **Niente orario duplicato**: una riga/fascia che inizia esattamente su un confine
  finestra (`windowStartSet`) nasconde la propria pill orario (`Rail hidePill`,
  `railLineFull` per la linea continua) — il marker adiacente mostra già quell'ora.
- `dayBookWindow` (min/max di tutte le fasce) resta solo per la CTA empty-state
  "Prenota una guida"; **non** governa più i marker (collassava le fasce multiple).

### Slot libero = banda "fantasma" (recessiva)

`BookableBand` NON è più una card bianca piena (era rumore: ogni buco ripeteva
"Tieni premuto per prenotare", competendo con le guide). Ora è una **banda bassa
tratteggiata** (`#D6D9E6` dashed, h 56) che mostra solo `Libero · <durata>` + una
pill navy `+`. Così le **guide prenotate dominano** la timeline e i vuoti recedono.
- **Hold-to-scrub a livello GIORNATA**: lo scrub NON è più clampato alla singola
  finestra. `BookableBand` riceve `bookableStarts` = l'array di **tutti** gli orari
  prenotabili del giorno (griglia 15min su tutte le `freeRows`, ascendente) e si
  muove **per indice** in quella lista. Quindi tenendo premuto sul blocco 09–14 e
  trascinando oltre le 13:45 il dito **salta** direttamente alle 15:00 (la pausa e
  le guide occupate semplicemente non sono nella lista). Long-press 220ms, haptic
  per step; tap = prenota a inizio finestra di quel blocco.
- **`onPick` risolve la finestra giusta**: siccome il rilascio può cadere in un
  blocco diverso da quello tenuto premuto, `renderFree` cerca in `freeRows` la
  finestra che contiene `min` e la passa a `openQuickBookSheet` (altrimenti il suo
  clamp `[windowStart, windowEnd-15]` riporterebbe indietro un pick cross-banda).
- **Hint una volta sola**: la caption "Tieni premuto su uno slot per scegliere l’ora"
  appare solo sulla **prima** fascia libera del giorno (`showHint`, flag `freeHintShown`
  nel loop di render), non su ognuna.

## Segmented control "Airbnb"

Stesso componente di `app/(tabs)/role/availability-exception.tsx`: track `#EBEBEB`,
pill bianca animata (`translateX`, `withTiming 220ms`), testo `#717171` → attivo
`#1A1A2E`. Larghezza pill = `(tabsW - 10) / 2` misurata con `onLayout`.

## Note

- **Malattia** resta fuori dalla gesture (solo nel menu FAB `+`): la gesture è pensata
  per un singolo slot, la malattia è da-ora-a-fine-giornata.
- **Page sheet, non più fitToContents** (2026-07-02): il form guida in modalità moto
  (auto al seguito + moto aggiuntive) supera lo schermo e una formSheet
  content-hugging su iOS clippa senza scrollare. `quick-book` ora usa `PAGE_SHEET`;
  `BookingForm` renderizza sempre il body in `ScrollView` flex:1 con footer pinnato,
  `BlockForm` embedded usa `SheetScaffold fill`.
- **Veicolo pre-impostato = ultima selezione in prenotazione** (2026-07-03): quando la
  sheet si apre, `BookingForm` rilegge da `lastBookingSelection` (AsyncStorage, chiave
  per `instructorId`) il veicolo scelto nell'ULTIMA prenotazione andata a buon fine e
  lo preseleziona **solo se è ancora tra i veicoli disponibili**; se è una moto con
  regola auto-al-seguito attiva, ripristina anche l'ultima auto al seguito
  (`'__none__'` incluso, se ancora valida). Fallback: `defaultVehicleId` seminato da
  `IstruttoreHomeScreen` (veicolo fisso dell'istruttore, poi primo della lista). Le
  prenotazioni auto NON sovrascrivono l'auto al seguito memorizzata dalle moto. La
  selezione si salva a submit riuscito (niente salvataggi su flussi abbandonati).
- Il vecchio **drawer in-screen** (`quickBookOpen`, `qbDrawer*`, `openQuickBook`,
  `handleQuickBook/BlockConfirm`, `quickBookStore`) è stato **rimosso**.

## Preview di design

`plans/frontend/quick-book-redesign.html` (interattiva).
