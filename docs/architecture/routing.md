# Routing & Tabs

## Stack
Expo Router 6, file-based routing.

## Route groups

**`(auth)/`** — unauthenticated: login, signup, company-select, role-blocked, invite/[token]

**`(tabs)/`** — authenticated, conditional tabs by role:
| Tab | Shown to | Screen |
|-----|----------|--------|
| home | All | AllievoHome / IstruttoreHome / TitolareHome (role dispatch) |
| role | Instructor, Owner | RoleHomeScreen (agenda) |
| notes | Instructor, Owner | Notes management + ClusterSettings |
| payments | Student (if autoPayments) | AllievoPaymentsScreen |
| swaps | Student (if swaps enabled) | SwapOffersScreen |
| more | All | MoreScreen → settings, vehicles, instructors, hours |
| settings | All | SettingsScreen |

Sub-routes: home/create-exam, home/notifications, notes/[studentId], notes/cluster-settings, more/settings, more/vehicles, more/instructors-overview, more/instructor-hours

## Tab bar
- iOS: native tabs (`NativeTabs` + `GlassTabBar.ios.tsx`)
- Android: custom animated tab bar (`GlassTabBar.tsx`, Reanimated, pink highlight)

## Key files
- `app/_layout.tsx` — root: SessionProvider, StripeProvider, push intent peek
- `app/(tabs)/_layout.tsx` — tab bar + NotificationOverlay mount
- `app/(auth)/_layout.tsx` — auth stack
