# Session & Auth

## File
`src/context/SessionContext.tsx` — React Context (no Redux/Zustand)

## Status flow
`loading` → `unauthenticated` → `company_select` → `ready`

## Provided values
- `user`, `token`, `companies`, `activeCompanyId`
- `autoscuolaRole` (OWNER, INSTRUCTOR_OWNER, INSTRUCTOR, STUDENT)
- `instructorId` (for instructor/owner roles)
- `status` (auth state)

## Methods
`signIn`, `signUp`, `signOut`, `selectCompany`, `refreshMe`

## Storage
- Native: `expo-secure-store`
- Web: `localStorage`

## Auto-invalidation
401 API responses trigger `signOut()` via event emitter in `apiClient.ts`.

## Usage
Used by 17 screens + NotificationOverlay. Provides role for conditional rendering and tab visibility.

## Feature flag hooks
| Hook | Purpose | Used by |
|------|---------|--------|
| `useAutoPaymentsEnabled` | Company-level, cached | Tab visibility, SettingsScreen |
| `useSwapEnabled` | Student-level, checks booking options | Tab visibility, SwapOffersScreen |
| `useStudentNotesEnabled` | Feature gate for notes | Tab visibility, notes screens |
| `useVehiclesEnabled` | Feature gate for vehicles | Vehicle screens |
