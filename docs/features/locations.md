# Locations (Luoghi guida)

## What it does
Instructor/owner management of driving-lesson locations: the read-only company **sede** (default location) + custom locations (parking, meeting points, practice areas), each optionally "precise" (geocoded via Google Places → openable in Maps).

## Key files
- `src/screens/LocationsScreen.tsx` — list (sede + custom), reached from "Altro" → Luoghi guida (`(tabs)/more/locations`)
- `app/(tabs)/more/location-form.tsx` — add/edit **formSheet route** (Google Places autocomplete); driven by `locationFormStore`
- `src/stores/locationFormStore.ts` — publishes `{ initial, onSubmit }` to the form route
- `src/hooks/queries/useLocations.ts` — cache-first react-query hook (`queryKeys.locations`, `STALE_TIMES.locations` 15min)

## Data & API
- Type `AutoscuolaLocation` (`isDefault` = sede, `isPrecise` = geocoded, `latitude/longitude/placeId`)
- `regloApi.getLocations` / `createLocation` / `updateLocation(id, ...)` / `deleteLocation(id)`
- After any mutation: `queryClient.invalidateQueries({ queryKey: queryKeys.locations(activeCompanyId) })`
- Google Places: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (autocomplete + place details); degrades gracefully if missing

## Design (design-system aligned)
- Clean header (back + "Luoghi guida"), off-white bg
- Cards: white, radius 20, soft shadow (no border); sede icon neutral navy-on-grey (pink reserved for CTAs)
- Badge Precisa = green, Generica = neutral grey (**no yellow**)
- "+ Aggiungi" = pink pill CTA; per-card action row (Maps / Modifica / Elimina) under a hairline
- Empty state = `fluent-pin.png` in a white circle with soft shadow
- **Instant load**: `useLocations` renders from cache immediately; first load shows skeleton cards (not a full-screen spinner)
- Form migrated from custom `BottomSheet` (`LocationFormSheet`, deleted) to a native formSheet route (detent 0.9, grabber)

## Connected features
- **Booking Flow / Instructor Manage** — locations are pickable when creating/booking lessons (`LocationPickerSheet`, `InlineLocationPicker`, `IstruttoreHomeScreen` also call `getLocations`; they do not yet share `useLocations`)
- **Backend** — `getLocations`/`createLocation`/`updateLocation`/`deleteLocation`
