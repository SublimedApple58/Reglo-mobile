# Notifications

## What it does
Push notification handling, intent routing, persistent inbox with 30-day expiry.

## Key files
- `src/components/NotificationOverlay.tsx` — always-on overlay, mounted at `app/(tabs)/_layout.tsx`: inbox/badge, push intents, apre i fogli (non disegna più fogli propri: solo il toast)
- `src/screens/SlotOfferSheet.tsx` (rotta `app/(tabs)/home/slot-offer.tsx`) — foglio «Si è liberato un posto»
- `src/screens/LastMinuteSheet.tsx` (rotta `app/(tabs)/home/last-minute.tsx`) — foglio «Posti liberi a breve» / «Posti liberi» di un giorno
- `src/screens/bookingExceptionParts.tsx` — pezzi condivisi dei due fogli (date a parole, righe chiave/valore, successo «È tua»)
- `src/screens/NotificationInboxScreen.tsx` — inbox rendering
- `src/types/notifications.ts` — NotificationItem union, PersistedNotification
- `src/services/notificationStore.ts` — SecureStore persistence, read/dismissed flags
- `src/services/pushNotifications.ts` — Expo Push token management, intent extraction

## Push flow
1. `registerPushToken()` → Expo token → register with backend
2. `expo-notifications` handlers: foreground + tap
3. Intent extracted from `data.kind`
4. Stored in SecureStore, surfaced via `peekLaunchPushIntent()`
5. NotificationOverlay consumes intent → routes to UI

## Notification kinds and handlers
| Kind | UI | Action |
|------|-----|--------|
| `waitlist` (push `slot_fill_offer`) | **Rotta `/(tabs)/home/slot-offer?offerId=…`** (FORM_SHEET) | `respondWaitlistOffer()` accept («Prendi questa guida») / decline («No, grazie»). Vedi «Fogli dell'allievo» sotto |
| `swap` | **Navigates to `/(tabs)/home/swaps`** (no drawer) | Handled in the Scambi section |
| `confirmation` | **Navigates to `/(tabs)/home/swaps`** (no drawer) | Swap-accepted; tracked for inbox/badge only |
| `available_slots` | **Rotta `/(tabs)/home/last-minute`** (FORM_SHEET) | con `data.lastMinute: true` → finestra «ultimo minuto»; senza → `?date=` del giorno della push. `createBookingRequest()` |
| `holiday_declared` | Toast | Acknowledge |
| `weekly_absence` | Toast | Acknowledge |
| `sick_leave_cancelled` | Toast | Acknowledge |
| `appointment_rescheduled` | Toast | Acknowledge |
| `appointment_cancelled` | Toast | Acknowledge |
| `availability_published` | Toast + route | Route to home/booking |
| `exam_scheduled` | Inbox (nessun drawer) | **REG-604**. Esame fissato (`reason: "created"`) o orario appena definito (`reason: "time_set"`): un solo kind, il titolo del push distingue. Niente da accettare → solo posta, come `appointment_rescheduled` |
| `exam_ready_nudge` | Inbox (Toast) | **Owner-only**. Handler owner-gated in `NotificationOverlay` (`isOwner`). "N allievi pronti per l'esame". Id stabile `exam_ready_nudge_{companyId}` → dedup push/recovery. Overlay ora renderizza anche per titolare PURO (guard rilassato + prop `isOwner` da `_layout.tsx`). |

## «Orario da definire» (REG-604)

Un esame può non avere orario: l'autoscuola fissa la data e comunica la
convocazione a voce. Il backend salva `startsAt` alla **mezzanotte** come
segnaposto e lascia `endsAt` a `null`, quindi chi formatta `startsAt` senza
guardare `endsAt` scrive «00:00». Succedeva in sei punti dell'app allievo.

`src/utils/examTime.ts` → `examTimeIsTbd(appt)`, `EXAM_TIME_TBD`.

| File | Cosa mostrava |
|---|---|
| `AllievoHomeScreen.tsx` | chip ⏱ dell'hero esame e card esame compatta |
| `app/(tabs)/home/exam-detail.tsx` | l'ora grande dell'hero viola |
| `StudentMyNotesScreen.tsx` | `timeRange()` nelle card |
| `StudentNotesDetailScreen.tsx` | la timeline del pagellino |
| `NotificationInboxScreen.tsx` | *«Spostata al gio 08 ott · 00:00»* |

L'inbox non legge il testo del push: ricostruisce il sottotitolo da
`data.isExam` e `data.timeSet`. Entrambi sono **opzionali** — le notifiche già
in posta da prima del rilascio non li hanno, e in quel caso si comporta come
sempre.

> ⚠️ **Non confondere con `isExamPlaceholder`** (`src/utils/weeklyAgenda.ts`),
> che è `type === 'esame' && !studentId`: quello è l'esame senza **allievi**,
> un altro concetto. Le scritte «Orario da definire» degli schermi istruttore
> sono attaccate a quello. Il marcatore giusto qui è **`!endsAt`**.

**Non toccati**: gli schermi istruttore/titolare, dove «Orario da definire»
funzionava già. `components/LessonsOverview.tsx` e `agendaLessons` /
`visibleAgendaLessons` in `AllievoHomeScreen` formattano l'orario ma sono
**codice morto** (mai importati / mai renderizzati): fuori perimetro.

## Inbox features
- **Clay v2 (REG-639 notte, 28/10/2026, commit `302f679`)** — `NotificationInboxScreen`:
  - testata come l'Agenda: titolo grande «Notifiche» + riga grigia («Hai
    aggiornamenti da leggere» / «Sei in pari»), «Segna tutte come lette» =
    `ClayIconButton` con `checkmark-done` a destra (solo se ci sono non lette);
  - **indietro** (`ClayIconButton` «back», `testID="inbox-back"`) sempre quando
    la schermata è spinta, e **anche quando è la tab** nell'app istruttore
    (`INSTRUCTOR` / `INSTRUCTOR_OWNER`): lì «Notifiche» non è nella barra, si
    apre dalla campanella dell'Agenda (`InboxBellButton`). Torna indietro o, se
    non c'è storia, a `/(tabs)/home`;
  - **campanella = push nello stack corrente** (REG-639 fluidità, 28/10/2026):
    `home/notifications` dall'Agenda, `drive/notifications` dalla tab Road
    (`useStackBase`), così si chiude con lo swipe indietro nativo; prima saltava
    alla tab nascosta `inbox`. Anche la bolla di `NotificationOverlay` per
    l'istruttore apre `home/notifications`; le righe premute hanno gli angoli
    della card (ritaglio di `ClayList`, `clayRowPadding` + `markClayRow`);
  - **raggruppate per giorno**: una `ClaySection` per giorno («Oggi», «Ieri»,
    poi «Lunedì 26 ottobre», `groupByDay`) con dentro una `ClayList` delle card;
    `ScrollView` semplice (non più `Animated.FlatList`), niente blur;
  - via le icone per tipo (`ICON_MAP`) e le chip colorate: le righe sono solo
    testo (titolo + sottotitolo + ora); swipe per eliminare con l'azione
    «Elimina» in rosso `#C13515` (unico colore);
  - stato vuoto = `ClayEmpty` con l'icona di morale **aeroplanino**
    (`MORALE_ART.aeroplanino`), «Nessuna notifica». Il vecchio
    `fluent-bell.png` è stato eliminato.
- *(Storico, prima del 28/10)* Design-system layout: sticky blur header (back + "Notifiche" + "Segna tutte"), off-white, `Animated.FlatList`, per-kind tinted icon chips (`THEME` map), Fluent `fluent-bell.png` empty state. No beige.
- Tap routing: swap/confirmation → `/(tabs)/home/swaps`; `group_lesson_invite` → `/(tabs)/home/group-lesson-invites`; `opensDrawer()` kinds (`waitlist`, `available_slots`) → `emitOpenDrawer` → l'overlay apre la rotta del foglio.
- Swipeable cards (right-swipe dismisses)
- Mark as read / mark all read
- 30-day expiry with optional expiresAt override
- Per-user scoped in SecureStore

## Removed overlay drawers (gradual BottomSheet phase-out)
- **Swap drawer** + **"Affare fatto!" (swap-accepted confirmation) drawer** removed from `NotificationOverlay`. Both `swap` and `confirmation` are swap-related → inbox tap routes to `/(tabs)/home/swaps`, never a drawer. `openDrawerForItem`/auto-open early-return on `swap`/`confirmation`. `confirmations` list is kept (inbox/badge only).
- **"Troppo tardi!" (expired)** drawer removed; dal 10/11/2026 anche il toast «Offerta non più disponibile» e il drawer «Già fatto!» (`staleDrawerKind`): ci pensa il foglio `slot-offer`.

## Fogli dell'allievo (prenotazione «solo eccezioni», 10/11/2026)

I tre BottomSheet fatti a mano dell'overlay — «Slot liberato!», «Scegli un
orario», «Già fatto!» — e la `BookingCelebration` dell'overlay sono stati tolti.
Al loro posto due rotte FORM_SHEET dello stack `home/`
(`docs/features/student-booking-exceptions.md`):

- **`slot-offer`** (`SlotOfferSheet`) — parametri `offerId` (+ `studentId`,
  `startsAt`, `endsAt`, `expiresAt`, `accepted=1` come suggerimenti). Si apre:
  push `slot_fill_offer` a caldo (ricevuta o toccata) e a freddo
  (`data.offerId`, `data.startsAt`), tocco in posta (`waitlist`: id offerta =
  `data.id`, dal recupero server l'id in posta è `waitlist_<id>`), apertura
  automatica con una sola non letta ancora valida, card della home. Si apre
  SEMPRE, anche se l'offerta non c'è più: è il foglio a dire «Per un soffio!»,
  «Tempo scaduto», «sei già in guida» o «È tua» (prima: toast «Offerta non più
  disponibile» / drawer «Già fatto!»).
- **`last-minute`** (`LastMinuteSheet`) — push `available_slots`: con
  `lastMinute` la finestra dell'ultimo minuto; senza (prenotazione aperta) lo
  stesso foglio su `?date=` del giorno della push. Scelta motivata: il flusso
  completo della home (`booking-flow`) vive nello store della home e chiede
  durata/tipo/istruttore; per «si sono liberati posti giovedì» basta scegliere
  l'orario, come faceva «Scegli un orario».

Doppie aperture: la stessa push arriva due volte (ricevuta in primo piano +
toccata) e l'apertura automatica può chiedere lo stesso foglio:
`shouldOpen(key)` in overlay apre una volta ogni 60 s per offerta / giorno.
Le offerte accettate stanno in SecureStore `reglo_accepted_notification_ids`
(le scrive `SlotOfferSheet`, le legge l'overlay prima di aprire).
`available_slots` in posta ora può portare anche `lastMinute: true`.

Restano custom: `CalendarDrawer` (Modal) e il `TimePickerDrawer` legacy degli
schermi istruttore. Il kind `proposal` non esiste più (né drawer né handler).

## Adding a new notification kind (full checklist)
1. `src/types/notifications.ts` — add to NotificationItem union + standalone data type
2. `src/components/NotificationOverlay.tsx` — add handler in subscribePushIntent
3. `src/screens/NotificationInboxScreen.tsx` — add to getTitle(), getSubtitle(), and opensDrawer() if it should open a drawer (ICON_MAP/THEME non esistono più dal 28/10, REG-639)
4. `../reglo/app/api/autoscuole/notifications/route.ts` — add recovery query
5. `../reglo/` action file — add `sendAutoscuolaPushToUsers()` call

## Connected features
- **ALL features** — NotificationOverlay routes intents to all screens
- **Backend** — recovery endpoint, push token management
