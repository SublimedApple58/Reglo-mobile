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
