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
| more | All | MoreScreen → settings, vehicles, instructors, hours |
| settings | All | SettingsScreen |

Swaps is **not** a tab — it's a home sub-route (`home/swaps`, SwapOffersScreen), opened from the home "Scambi" CTA when swaps are enabled.

Sub-routes: home/create-exam, home/notifications, home/swaps, notes/[studentId], notes/cluster-settings, notes/time-picker (formSheet), notes/group-students (page sheet), more/settings, more/profile-edit (formSheet), more/agenda-view (formSheet), more/availability-mode (formSheet), more/agenda-settings (formSheet), more/location-form (formSheet), more/hours-period (formSheet), more/vehicles, more/instructors-overview, more/instructor-hours

## Tab bar
- iOS: native tabs (`NativeTabs` + `GlassTabBar.ios.tsx`)
- Android: custom animated tab bar (`GlassTabBar.tsx`, Reanimated, pink highlight)

## Key files
- `app/_layout.tsx` — root: SessionProvider, StripeProvider, push intent peek
- `app/(tabs)/_layout.tsx` — tab bar + NotificationOverlay mount
- `app/(auth)/_layout.tsx` — auth stack
