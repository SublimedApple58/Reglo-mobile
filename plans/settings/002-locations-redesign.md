# Luoghi guida (Locations) — Redesign + instant load

## What was done
Total redesign of the "Luoghi guida" screen (reached from Altro → Luoghi guida), cache-first loading, and migration of the add/edit form from a custom BottomSheet to a native formSheet route. Design-system aligned, no yellow.

## User directives
- Stay in the "Altro" tab.
- Optimize loading (was "not bad" — full-screen spinner + no cache).
- Totally redo page structure + design.
- Decisions: form → **formSheet route**; loading → **react-query hook (cache-first)**; card actions → **action row at bottom**.

## Changes
1. **`src/hooks/queries/queryKeys.ts`** — `STALE_TIMES.locations` (15min) + `queryKeys.locations(companyId)`.
2. **`src/hooks/queries/useLocations.ts`** (NEW) — cache-first query hook.
3. **`src/stores/locationFormStore.ts`** (NEW) — `{ initial, onSubmit }` for the form route.
4. **`app/(tabs)/more/location-form.tsx`** (NEW) — formSheet route (detent 0.9, grabber), ports the Google Places autocomplete + restyled inputs; KeyboardAvoidingView + sticky Salva footer.
5. **`app/(tabs)/more/_layout.tsx`** — registered `location-form` formSheet.
6. **`src/screens/LocationsScreen.tsx`** — rewrite: clean header, `useLocations` + skeleton cards (no full-screen spinner), redesigned sede + custom cards (radius 20, soft shadow, neutral sede icon, green/neutral badges — no yellow), pink "+ Aggiungi" pill, action row (Maps/Modifica/Elimina), `fluent-pin.png` empty state; opens the form via `locationFormStore` + `router.push`. Mutations invalidate `queryKeys.locations`.
7. **`src/components/LocationFormSheet.tsx`** — DELETED (migrated; was only used here).
8. Docs: new `docs/features/locations.md`, INDEX + impact-map + routing updated.

## Verify
- tsc clean (only pre-existing TabNavigator error).
- Instant render on revisit (cache); skeletons on cold load.
- Add/edit opens the formSheet with Places autocomplete; save persists + list refreshes (invalidate).
- No yellow; pink only on "+ Aggiungi" and the form Save CTA.

## Follow-up (not done)
`LocationPickerSheet`, `InlineLocationPicker`, `IstruttoreHomeScreen` still call `getLocations` directly — could adopt `useLocations` to share the cache.
