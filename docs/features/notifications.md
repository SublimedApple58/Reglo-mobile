# Notifications

## What it does
Push notification handling, intent routing, persistent inbox with 30-day expiry.

## Key files
- `src/components/NotificationOverlay.tsx` (70KB) — always-on overlay, mounted at `app/(tabs)/_layout.tsx`
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
| `waitlist` | BottomSheet | `respondWaitlistOffer()` accept/decline |
| `swap` | **Navigates to `/(tabs)/home/swaps`** (no drawer) | Handled in the Scambi section |
| `confirmation` | **Navigates to `/(tabs)/home/swaps`** (no drawer) | Swap-accepted; tracked for inbox/badge only |
| `proposal` | BottomSheet | `updateAppointmentStatus()` accept/reject |
| `available_slots` | Modal | Route to booking |
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
- Design-system layout: sticky blur header (back + "Notifiche" + "Segna tutte"), off-white, `Animated.FlatList`, per-kind tinted icon chips (`THEME` map), Fluent `fluent-bell.png` empty state. No beige.
- Tap routing: swap → `/(tabs)/home/swaps`; `opensDrawer()` kinds (waitlist/proposal/confirmation/available_slots) still `emitOpenDrawer`.
- Swipeable cards (right-swipe dismisses)
- Mark as read / mark all read
- 30-day expiry with optional expiresAt override
- Per-user scoped in SecureStore

## Removed overlay drawers (gradual BottomSheet phase-out)
- **Swap drawer** + **"Affare fatto!" (swap-accepted confirmation) drawer** removed from `NotificationOverlay`. Both `swap` and `confirmation` are swap-related → inbox tap routes to `/(tabs)/home/swaps`, never a drawer. `openDrawerForItem`/auto-open early-return on `swap`/`confirmation`. `confirmations` list is kept (inbox/badge only).
- **"Troppo tardi!" (expired)** drawer removed — a taken/expired waitlist/proposal now shows a toast ("Offerta non più disponibile"). `staleDrawerKind` is now `'accepted' | null`.

## Remaining custom BottomSheets (allievo) — to migrate later
Still custom `BottomSheet` in `NotificationOverlay`, shown to students: **Waitlist** ("Slot liberato"), **Proposal** ("Nuova proposta"), **Available slots** ("Scegli un orario"), **"Già fatto!"** (already-accepted, waitlist/proposal). All backend kinds are live/reachable. `CalendarDrawer` (custom Modal) is also pending. Time picker (allievo Disponibilità): migrated to a **formSheet route** `app/(tabs)/settings/time-picker.tsx` (fitToContents, `timePickerStore`-driven), no duck mascot, pink selection. The legacy `TimePickerDrawer` component (instructor screens) now uses a native pageSheet Modal, duck removed — to be route-migrated with the instructor app.

## Adding a new notification kind (full checklist)
1. `src/types/notifications.ts` — add to NotificationItem union + standalone data type
2. `src/components/NotificationOverlay.tsx` — add handler in subscribePushIntent
3. `src/screens/NotificationInboxScreen.tsx` — add to ICON_MAP, THEME, getTitle(), getSubtitle(), and opensDrawer() if it should open a drawer
4. `../reglo/app/api/autoscuole/notifications/route.ts` — add recovery query
5. `../reglo/` action file — add `sendAutoscuolaPushToUsers()` call

## Connected features
- **ALL features** — NotificationOverlay routes intents to all screens
- **Backend** — recovery endpoint, push token management
