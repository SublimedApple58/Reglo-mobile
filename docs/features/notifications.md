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
| `swap` | BottomSheet | `respondSwapOffer()` accept |
| `confirmation` | Toast | Dismiss |
| `proposal` | BottomSheet | `updateAppointmentStatus()` accept/reject |
| `available_slots` | Modal | Route to booking |
| `holiday_declared` | Toast | Acknowledge |
| `weekly_absence` | Toast | Acknowledge |
| `sick_leave_cancelled` | Toast | Acknowledge |
| `appointment_rescheduled` | Toast | Acknowledge |
| `appointment_cancelled` | Toast | Acknowledge |
| `availability_published` | Toast + route | Route to home/booking |

## Inbox features
- Swipeable cards (right-swipe dismisses)
- Mark as read / mark all read
- 30-day expiry with optional expiresAt override
- Per-user scoped in SecureStore

## Adding a new notification kind (full checklist)
1. `src/types/notifications.ts` — add to NotificationItem union + standalone data type
2. `src/components/NotificationOverlay.tsx` — add handler in subscribePushIntent
3. `src/screens/NotificationInboxScreen.tsx` — add to ICON_MAP, getTitle(), getSubtitle(), ICON_COLOR_MAP, isInteractive()
4. `../reglo/app/api/autoscuole/notifications/route.ts` — add recovery query
5. `../reglo/` action file — add `sendAutoscuolaPushToUsers()` call

## Connected features
- **ALL features** — NotificationOverlay routes intents to all screens
- **Backend** — recovery endpoint, push token management
