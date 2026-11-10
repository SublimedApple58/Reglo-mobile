# Prenotazione allievi «solo eccezioni» (mobile)

Backend: `../reglo/docs/features/student-booking-exceptions.md` (branch
`feat/prenotazione-eccezioni`, non rilasciato). Anteprime approvate da Tiziano:
`/tmp/hiro-anteprime/prenotazione-eccezioni/` (mob-1…8).

## Cosa fa
L'autoscuola decide quando l'allievo prenota dall'app: **aperta** (prenota
liberamente), **solo eccezioni** (prenota da solo solo in casi precisi),
**disattiva**. Le eccezioni sono tre:

| Eccezione | Chiave | Dove la vede l'allievo |
|---|---|---|
| Un altro allievo annulla la sua guida | `slotFill` | push `slot_fill_offer` → foglio «Si è liberato un posto» |
| Si libera un posto in una guida di gruppo | `groupSeats` | «Posti liberi» in home → `group-lesson-invites` |
| Posti vuoti nelle prossime N ore | `lastMinute` (+ `lastMinuteHours`) | push `available_slots` con `lastMinute` / home → foglio «Posti liberi a breve» |

Il telefono non decide niente: legge lo stato dal server.

## Contratto `bookingPolicy`
`GET /api/autoscuole/booking-options` → `MobileBookingOptions.bookingPolicy`
(`src/types/regloApi.ts`):

```ts
{
  mode: 'open' | 'exceptions' | 'closed',
  hold: null | 'blocked' | 'awaiting' | 'theory' | 'license_missing',
  exceptions: { slotFill, groupSeats, lastMinute, lastMinuteHours },
  lastMinuteUntil: ISO | null, // fine della finestra «ultimo minuto»
}
```

Lettura unica in `src/utils/studentBookingPolicy.ts`:
`resolveStudentBookingPolicy(options)` (ripiego sui campi storici
`appBookingActors`/`bookingBlocked` se il backend è vecchio) aggiunge
`canBookFreely` e `canTakeSomething`; `bookingExceptionCases`,
`bookingExceptionsLead`, `bookingHoldMessage` danno i testi condivisi.

Push `available_slots`: `data.date` e, nell'ultimo minuto, `data.lastMinute:
true` + `data.lastMinuteHours`. Push `slot_fill_offer`: `data.offerId`,
`data.slotId`, `data.startsAt`. Recupero posta (`kind: 'waitlist'`): `data.id`,
`data.slot.{startsAt,endsAt}`, `data.expiresAt`.

## File
| File | Ruolo |
|---|---|
| `src/utils/studentBookingPolicy.ts` | stato della prenotazione + testi |
| `app/(tabs)/home/slot-offer.tsx` → `src/screens/SlotOfferSheet.tsx` | foglio «Si è liberato un posto» (FORM_SHEET) |
| `app/(tabs)/home/last-minute.tsx` → `src/screens/LastMinuteSheet.tsx` | foglio «Posti liberi a breve» / «Posti liberi» di un giorno (FORM_SHEET) |
| `src/screens/bookingExceptionParts.tsx` | date a parole, righe chiave/valore, stato centrato, successo «È tua» (cartina + mezzo), invalidazione dopo la prenotazione, offerte accettate in SecureStore |
| `src/components/NotificationOverlay.tsx` | apre i due fogli da push (calde e fredde), posta, apertura automatica |
| `app/(tabs)/home/_layout.tsx` | registra `slot-offer` e `last-minute` come `FORM_SHEET` |

## Flussi

### «Si è liberato un posto» (`slot-offer?offerId=…`)
Parametri: `offerId` (obbligatorio) e, come suggerimenti, `studentId`,
`startsAt`, `endsAt`, `expiresAt`, `accepted=1`. L'offerta si carica con
`getWaitlistOffers(studentId)` filtrando per id.

| Stato | Quando | Anteprima |
|---|---|---|
| caricamento | all'apertura: scheletro della stessa forma, CTA spenta | mob-6b |
| offerta | trovata e non scaduta: campanella oro, data, ora grande, «Ancora N minuti» con la barra che scende (lineare fino a `expiresAt`, su UI thread), righe Istruttore (solo se l'allievo è legato a un istruttore) e Luogo; «Prendi questa guida» + «No, grazie» | mob-6a |
| successo | `respondWaitlistOffer(accept)` → `accepted: true`: «È tua, Luca!» con cartina + moto/auto, Quando · Veicolo · Luogo (presi da `getAppointments` sulla guida creata), «Fatto». Sostituisce `BookingCelebration` | mob-6c |
| già preso | non più nell'elenco (senza altre cause) o risposta `accepted: false` / «Slot non disponibile»: «Per un soffio!» + fino a 3 altri posti (altre offerte, guide di gruppo aperte, primo posto dell'ultimo minuto di oggi) | mob-6d |
| scaduto | `expiresAt` passato (anche mentre il foglio è aperto) o «Offerta non più valida» a tempo scaduto | mob-6e |
| sovrapposto | l'allievo ha una guida che si sovrappone (dai suggerimenti + `getAppointments`) o l'accept risponde «Hai già una guida…» | mob-6f |

Il server toglie dall'elenco le offerte scadute, prese, sovrapposte e già
risposte: il PERCHÉ si ricava dai suggerimenti della notifica e dalle guide
dell'allievo. Un'offerta già accettata (SecureStore
`reglo_accepted_notification_ids`) riapre il successo. «No, grazie» =
`respondWaitlistOffer(decline)` e chiude. Bottoni con spinner, mai cambio
etichetta; nessun optimistic update; transizioni fra stati in dissolvenza
(`contentKey` di `FormSheet`, titolo con `SOFT_SWAP_IN`). Il successo mette la
cartina come `leading` assoluto della testata (la X resta sopra, il centro
trasparente la lascia sfumare sotto il titolo).

### «Posti liberi a breve» (`last-minute`)
- Senza parametri: giorni da oggi a `bookingPolicy.lastMinuteUntil` (o +N ore),
  `getAvailableSlots` per giorno in parallelo (il server filtra già la
  finestra), sezioni «Oggi», «Domani», «Giovedì 13».
- `?date=YYYY-MM-DD`: un giorno solo (push `available_slots` della
  prenotazione aperta), titolo «Posti liberi», sottotitolo con la data.
- Segmentato delle durate se più di una (`bookingSlotDurations`); elenco a
  spunta, una scelta, prima voce già scelta; `FormSheet list` (FlatList, un
  elemento per giorno, righe memo); scheletro; stato vuoto `ClayEmpty`
  (espresso).
- CTA «Prenota oggi alle 18:00» → `createBookingRequest({ selectedStartsAt,
  locationId })` come la home; `matched` → successo «È tua» nel foglio;
  non `matched` → avviso e ricarica.

Dopo ogni prenotazione riuscita: invalidate `appointments`,
`autoscuola-settings`, `booking-options` + `notificationEvents.emitDataChanged()`
e `requestRefresh()` (come `invalidateAllData` della home).

## Limiti del backend (oggi)
- L'offerta (`AutoscuolaWaitlistOfferWithSlot`) non porta istruttore né
  veicolo: si conoscono solo dopo l'accettazione (assegnazione). Nel foglio
  dell'offerta le righe sono Istruttore (solo se legato) e Luogo.
- `AvailableSlot` non porta istruttore né veicolo: sotto l'orario c'è il luogo
  (con più luoghi) o la durata, non «Sara Bianchi · Yamaha MT-03».
- La push `slot_fill_offer` non porta `endsAt` né `expiresAt`: aperta dalla
  push, un'offerta sparita si classifica senza la scadenza (i casi «sovrapposto»
  e «scaduto» si riconoscono meglio dalla posta).

## Connessioni
- `notifications.md` — l'overlay apre questi fogli.
- `booking-flow.md` — stessa `createBookingRequest`, stessi `slotLocation*`.
- Guide di gruppo — «Per un soffio!» rimanda a `group-lesson-invites`.

## Home con l'esame (approvata da Tiziano il 10/11/2026, anteprime 1i/1j)
- Con un esame prenotato la card protagonista è SEMPRE l'esame (`ExamHeroCard` in `src/screens/allievoHome/ExamHomeCards.tsx`): numero grande, una riga «4 dic · 9:30 · sede» (puntini se lunga), linea Oggi→Esame con un pallino per ogni guida fissata prima dell'esame.
- La prossima guida scende in `CompactLessonCard` (ritaglio dell'immagine + due righe; «Ultima guida» se è l'unica prima dell'esame). Niente frase sotto il nome e niente riquadri «guide fatte».
- Senza esame: card grande della prossima guida come prima.
- Misure: inset 20 pt per entrambe le card; side-bearing delle cifre compensato con `DIGIT_BEARING` (misurato a 64 pt peso 600, font di sistema).
