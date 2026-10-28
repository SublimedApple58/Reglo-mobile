# Quick-book (prenotazione veloce istruttore)

Prenotazione/blocco rapido dall'Agenda istruttore con l'orario già messo.

> **Stato al 29/10/2026 (REG-639 clay).** Si apre dal **blocco fantasma**
> della griglia settimanale (`WeeklyAgendaView`, unica vista dell'Agenda; vedi
> Flusso). La vista Giorno con i buchi «Libero» provata la notte del 28/10 è
> stata eliminata.
>
> Il foglio è **IL form sheet unico** (`FORM_SHEET` + `<FormSheet>`,
> design-system §13.2): il **titolo è un `ClaySegmented`** «Prenota guida» |
> «Blocca orario», il corpo è `<BookingForm embedded />` o
> `<BlockForm embedded />`, che si scambiano in dissolvenza (`contentKey`). La X
> clay in alto a destra è l'unico modo di chiudere. Le sezioni «Timeline
> giorno», «Slot libero = banda fantasma» e «Segmented control Airbnb» più sotto
> sono **storiche** (la timeline `BookableBand` e la vista giorno vecchia non
> esistono più dal 28/10).

## Architettura

I form delle due route dedicate sono **componenti condivisi**, riusati sia
dalle route standalone sia dal quick-book (embedded). Un solo source of truth ⇒
i form quick sono identici a quelli pieni per costruzione.

| File | Ruolo |
|------|-------|
| `src/components/booking/BookingForm.tsx` | Form completo prenotazione (allievo, multipla, giorno/ora/durata, luogo, veicolo, tipo). Da solo è un `<FormSheet>` (titolo, riepilogo come sottotitolo, CTA in fondo); `embedded` rende solo contenuto + riepilogo + CTA in coda dentro il FormSheet del quick-book. Legge `bookingSheetStore`. |
| `src/components/booking/BlockForm.tsx` | Form completo «Blocca orario» / lezione teorica (giorno, ora inizio/fine, motivo, ripeti settimane). Stessa logica `embedded`. Legge `blockSheetStore`. |
| `app/(tabs)/home/new-booking.tsx` | Route standalone (foglio «Nuovo» → Guida) → `<BookingForm />`. `FORM_SHEET`. |
| `app/(tabs)/home/block-slot.tsx` / `theory-lesson.tsx` | Route standalone → `<BlockForm />`. `FORM_SHEET`. |
| `app/(tabs)/home/quick-book.tsx` | Il quick-book: `<FormSheet title={<ClaySegmented …/>} contentKey={mode}>` + form embedded. `FORM_SHEET` (era `PAGE_SHEET` dal 2026-07-02: ora il FormSheet scorre da sé, quindi anche il form moto lungo ci sta). |
| `src/utils/lastBookingSelection.ts` | Memoria per-istruttore (AsyncStorage) dell'ultimo veicolo/auto al seguito **selezionati prenotando** (≠ ultimo veicolo usato). Salvata da `BookingForm` a prenotazione riuscita; riletta all'apertura per preimpostare i picker. |
| `src/stores/bookingSheetStore.ts` | Dati booking + callback optimistic. Campo `presetStartMinutes?` (quick-book). |
| `src/stores/blockSheetStore.ts` | Dati block + callback optimistic. Campo `presetStartMinutes?` (quick-book). |

## Flusso

1. **Origine** in `IstruttoreHomeScreen` (vedi [agenda-istruttore.md](agenda-istruttore.md)):
   - **Vista Settimana** (`WeeklyAgendaView`): **blocco fantasma** (2026-06-12) — hold (220ms) su spazio libero genera un blocco draft da 1h che si trascina live (15' step verticali, cross-colonna orizzontale); release lo piazza → knob alto/basso per la durata (30'–4h) + CTA bottom "Scegli i dettagli". Tap su spazio libero = piazza il blocco lì (o dismisses quello esistente). Il blocco piazzato si ri-trascina con hold (160ms). Posizione/size su shared values (UI thread, zero re-render); label via mini pub/sub `ghostTimeLabel`/`ghostDurLabel`; bolla finger = `ScrubBubble`. CTA conferma → `onBookAt(date, start, start, start+dur, dur)`. `onGhostActiveChange` nasconde il FAB mentre la CTA è visibile. Dismiss: ✕, conferma, swipe settimana, tap fuori, unmount.
2. `openQuickBookSheet(date, startMinutes, windowStart, windowEnd, durationMinutes?)` calcola il preset
   clampato; la durata del blocco fantasma (step liberi da 15') viene **snappata alla
   durata consentita più vicina** e passata come `presetDurationMinutes` →
   `seedBookingStore(date, preset, presetDur)` la usa come `defaultDuration`.
   Poi semina anche `seedBlockStore(date, preset)` e fa
   `router.push('/(tabs)/home/quick-book')`.
3. La route renderizza il form scelto dal segmentato; il **parent (home) possiede la
   logica optimistic** (insert/replace/reconcile/remove) tramite le callback degli store
   — nessuna duplicazione di logica weekly-limit / recurring.

## Timeline giorno (rail itinerario) — STORICO (fino al 28/10/2026)

> Descrive la vista giorno precedente a REG-638/639 (`seq`, `ItinRow`,
> `BookableBand`, hold-to-scrub). Eliminata con REG-638: oggi si prenota
> solo dal blocco fantasma della griglia settimanale.

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

## Segmented control "Airbnb" — STORICO

> Sostituito da `ClaySegmented` (design-system §0.7) come titolo del FormSheet.

Stesso componente di `app/(tabs)/role/availability-exception.tsx`: track `#EBEBEB`,
pill bianca animata (`translateX`, `withTiming 220ms`), testo `#717171` → attivo
`#1A1A2E`. Larghezza pill = `(tabsW - 10) / 2` misurata con `onLayout`.

## Chi compare nel picker allievo

Solo la fase **PRATICA** (REG-499, 19/09/2026). Un AWAITING non ha il percorso
attivato, un TEORIA non ha ancora il foglio rosa, un PATENTATO ha finito: prima
comparivano tutti e tre, e l'istruttore selezionava gente a cui non può fissare
una guida. Il filtro sta in `IstruttoreHomeScreen.bookingStudentOptions`
(`bookableStudents`) — la fase arriva già col bootstrap agenda
(`AutoscuolaStudent.studentPhase`), non serve nessuna chiamata in più.

`studentPhase` assente ⇒ trattato come PRATICA: è il default dello schema, e le
autoscuole che le fasi non le usano devono continuare a vedere tutti.

Il filtro vale per entrambe le strade (FAB `new-booking` e quick-book: stesso
`BookingForm`, stesse opzioni) e per il titolare in `ownerMode`. Il backend non
impone la fase allo staff — dall'agenda web si prenota ancora per chiunque.

## «Auto al seguito occupata» — auto sostitutiva per data (REG-608 / T7)

Una prenotazione multipla condivide **tutto** fra le date tranne una cosa:
l'**auto al seguito**. Prima bastava che fosse occupata in UNA data per far
fallire l'intero batch (è una transazione tutto-o-niente), con un messaggio che
non diceva nemmeno quale auto fosse. Ora, al tocco su «Prenota N guide»:

1. **Prova a vuoto** (`regloApi.checkInstructorBookingBatch` →
   `POST /api/autoscuole/instructor-bookings/check-batch`): non scrive niente,
   dice quali date sono libere, perché le altre no e **quali auto al seguito
   sono libere in ciascuno slot**. Non controlla il limite settimanale: quella
   conferma resta sulla creazione vera (e si chiede *prima* della prova).
2. Nessun conflitto → si prenota come sempre, **l'utente non vede niente di
   nuovo** (il caso normale).
3. Altrimenti si apre il foglio **«Auto al seguito occupata»**
   (`FollowCarConflictSheet`): una riga per ogni data da sistemare, l'auto
   sostitutiva si scegli dal picker nativo delle sole auto **libere a
   quell'ora**, con la scorciatoia «Applica a tutte» quando una macchina è
   libera in tutte le date in conflitto. Le date libere non si elencano: sono
   già riassunte in cima. **Il punto è trovare un'altra auto, non un'altra data.**
4. Le guide si creano **alla fine, tutte insieme**: «Prenota N guide» (richiede
   una risposta per ogni riga) oppure «Prenota solo le N libere».

| File | Ruolo |
|------|-------|
| `src/stores/followCarConflictStore.ts` | Esito della prova a vuoto + `onConfirm`. `followCarConflictPath()`: **1-3** conflitti → `follow-car-conflict`, **4+** → `follow-car-conflict-long`. Dal 28/10 (REG-639) **entrambe** `FORM_SHEET` + `<FormSheet>` (erano `HUG_SHEET` / `PAGE_SHEET`). |
| `src/components/booking/FollowCarConflictSheet.tsx` | Il foglio. `scrollable={false}` radice `<View>` senza ScrollView (il `fitToContents` non la sa misurare), `scrollable` corpo che scorre + CTA ancorata. |
| `app/(tabs)/home/follow-car-conflict.tsx` / `-long.tsx` | Le due rotte, stesso componente (stesso schema di `select-options` / `select-options-long`). |
| `BookingForm.confirmMulti` | Prova a vuoto → foglio → `submitBatch`. `batchSharedPayload()` è l'unico posto dove si dice cosa è condiviso. |

Risposte possibili per riga: un'auto libera · «Nessuna auto al seguito» ·
«Togli la guida» (con «Ripristina»). `entries[].followVehicleId` ha **tre stati
da non appiattire**: assente = eredita l'auto condivisa, `null` = nessuna auto,
id = quell'auto.

**Il foglio si chiude prima di prenotare**: lo spinner resta uno solo, quello
della CTA del form sotto. Se la creazione fallisce comunque (qualcuno ha preso
lo slot fra la verifica e la conferma), `runBooking` chiama `onFailure` → si
rifà la prova a vuoto e si torna sul foglio aggiornato, invece di buttare via
tutto il lavoro di scelta.

**Se la prova a vuoto non risponde** (rete, oppure un backend che non conosce
ancora la rotta) si prenota come si è sempre fatto, tutto-o-niente: una
verifica che è solo un aiuto non deve poter bloccare una prenotazione.

**Il controllo è lo stesso del web** (`reglo/lib/autoscuole/conflict-scan.ts`):
prova a vuoto e creazione passano dalla stessa funzione, quindi non possono
dire due cose diverse. Lo dicevano, fino a REG-616: le righe d'agenda si
leggono una volta sola per tutte le date e bastava che una qualsiasi si
sovrapponesse perché la data risultasse bloccata «dall'istruttore» — la
creazione rifiutava *dopo* che l'utente aveva scelto l'auto sostitutiva. È il
difetto che è saltato fuori provando questo foglio fino in fondo.

Gemello web: `reglo/components/pages/Autoscuole/dialogs/FollowCarConflictPane.tsx`
(REG-613) — stessi testi, stesse regole.

## Note

- **Blocco prenotazioni dell'allievo (REG-499)**: non ferma l'istruttore. Se il
  titolare ha bloccato le prenotazioni di un allievo, l'istruttore può prenotargli
  una guida lo stesso — il blocco toglie il self-service all'allievo, non l'agenda
  all'autoscuola. Il backend risponde `success` con un `warnings` che oggi l'app
  **non** mostra (lo legge solo l'agenda web).
- **Prenotazione nel passato consentita con conferma** (2026-07-15): `openDatePicker` usa
  `allowPast: true` (+ `monthsBack: 3`) → i giorni passati sono selezionabili. In
  `confirmSingle`/`confirmMulti` un `Alert.alert` nativo ("Annulla" / "Prenota comunque")
  scatta se lo start è nel passato (`confirmPastIfNeeded`); alla conferma la chiamata parte
  con `allowPast: true` (tipi `ConfirmInstructorBooking(Batch)Input.allowPast`). Il BE
  (`createAutoscuolaAppointment`/`...Batch`) salta il blocco solo con quel flag. Batch:
  conferma sulla guida più vecchia nel passato. Il clamp `nowMin` della timeline giorno
  (`IstruttoreHomeScreen`) resta com'è: è solo un'affordance di scrub, non un blocco.
- **Malattia** resta fuori dalla gesture (solo nel menu FAB `+`): la gesture è pensata
  per un singolo slot, la malattia è da-ora-a-fine-giornata.
- **(Storico, superato dal FormSheet REG-639)** **Page sheet, non più fitToContents** (2026-07-02): il form guida in modalità moto
  (auto al seguito + moto aggiuntive) supera lo schermo e una formSheet
  content-hugging su iOS clippa senza scrollare. `quick-book` ora usa `PAGE_SHEET`;
  `BookingForm` renderizza sempre il body in `ScrollView` flex:1 con footer pinnato,
  `BlockForm` embedded usa `SheetScaffold fill`.
- **Sezione Veicolo nascosta finché non c'è l'allievo** (2026-07-03): la riga Veicolo
  (e a cascata Auto al seguito / Moto aggiuntive) compare con `FadeInDown` +
  `LinearTransition` solo dopo la selezione dell'allievo — niente più placeholder
  "Scegli prima l'allievo".
- **Preset = ultima selezione in prenotazione, per TIPO** (2026-07-03):
  `lastBookingSelection` (AsyncStorage, chiave per `instructorId`) tiene DUE slot
  indipendenti: `car` (ultima auto) e `moto` (ultima moto + auto al seguito,
  `'__none__'` incluso, + moto aggiuntive). Alla selezione dell'allievo,
  `presetVehiclesForStudent` sceglie lo slot dal suo percorso patente (moto → slot
  moto, altrimenti slot auto) e lo applica **solo se i veicoli ricordati sono ancora
  disponibili e idonei** a quell'allievo; una scelta manuale ancora idonea NON viene
  sovrascritta al cambio allievo. Fallback: `defaultVehicleId` (veicolo fisso
  dell'istruttore, poi primo della lista) se idoneo, altrimenti vuoto. Il salvataggio
  avviene a submit riuscito nello slot del tipo prenotato (una prenotazione auto non
  tocca la memoria moto e viceversa; regola auto-al-seguito spenta → conserva l'auto
  al seguito ricordata).
- Il vecchio **drawer in-screen** (`quickBookOpen`, `qbDrawer*`, `openQuickBook`,
  `handleQuickBook/BlockConfirm`, `quickBookStore`) è stato **rimosso**.

## Preview di design

`plans/frontend/quick-book-redesign.html` (interattiva).
