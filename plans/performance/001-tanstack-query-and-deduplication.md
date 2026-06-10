# Performance Optimization — TanStack Query & Request Deduplication

## What was done

### Phase 2A: Installed TanStack Query
- Added `@tanstack/react-query` to `package.json`.
- Configured `QueryClient` in `app/_layout.tsx` with `staleTime: 2min`, `gcTime: 10min`, `retry: 1`.
- Wired up React Native `AppState` to TanStack Query `focusManager` for automatic foreground refetch.

### Phase 2B: Shared query hooks
- Created `src/hooks/queries/useAutoscuolaSettings.ts` — single `useQuery` for settings, auto-deduplicated.
- Created `src/hooks/queries/useBookingOptions.ts` — single `useQuery` for booking options, per-student.

### Phase 2C: Refactored feature flag hooks
All 5 hooks rewritten to use `useAutoscuolaSettings()` instead of direct API calls:
- `useAutoPaymentsEnabled` — reads `autoPaymentsEnabled` from shared settings query.
- `useStudentNotesEnabled` — reads `studentNotesEnabled`.
- `useVehiclesEnabled` — reads `vehiclesEnabled`.
- `useQuizEnabled` — reads `quizEnabled`.
- `useSwapEnabled` — reads from both `useAutoscuolaSettings` and `useBookingOptions`.

Removed all module-level `Map` caches (TanStack handles caching).

### Phase 2D: AllievoHomeScreen optimization
- Moved `getBookingOptions` into the existing `Promise.all` (was sequential after it).
- Removed manual `AppState` listener (TanStack `focusManager` handles this globally).
- Removed unused `AppState` import.

## Files changed
- `package.json`
- `app/_layout.tsx`
- `src/hooks/queries/useAutoscuolaSettings.ts` (new)
- `src/hooks/queries/useBookingOptions.ts` (new)
- `src/hooks/useAutoPaymentsEnabled.ts`
- `src/hooks/useStudentNotesEnabled.ts`
- `src/hooks/useVehiclesEnabled.ts`
- `src/hooks/useQuizEnabled.ts`
- `src/hooks/useSwapEnabled.ts`
- `src/screens/AllievoHomeScreen.tsx`
