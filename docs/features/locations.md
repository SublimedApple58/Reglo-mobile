# Locations (Luoghi guida)

## What it does
Instructor/owner management of driving-lesson locations: the read-only company **sede** (default location) + custom locations (parking, meeting points, practice areas), each optionally "precise" (geocoded via Google Places → openable in Maps).

## Key files
- `src/screens/LocationsScreen.tsx` — list (sede + custom), reached from "Altro" → Luoghi guida (`(tabs)/more/locations`)
- `app/(tabs)/more/location-form.tsx` — add/edit **formSheet route** (Google Places autocomplete); driven by `locationFormStore`
- `src/stores/locationFormStore.ts` — publishes `{ initial, onSubmit }` to the form route
- `src/hooks/queries/useLocations.ts` — cache-first react-query hook (`queryKeys.locations`, `STALE_TIMES.locations` 15min)
- `src/utils/locationForLicense.ts` — resolver puro del Luogo precompilato (REG-409), gemello del modulo web

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

## Luogo precompilato per tipo di patente (REG-409)
Il titolare assegna dal **web** (Impostazioni → Sede e luoghi) uno o più tipi di
patente a ogni luogo, sede compresa. Il mobile legge il campo
(`AutoscuolaLocation.licenseCategories`, opzionale: assente sui backend
pre-REG-409 = lista vuota) e lo usa **solo in lettura** per precompilare il campo
"Luogo" in creazione guida.

**Precedenza** (dal più specifico al più generico), in `src/utils/locationForLicense.ts`:
1. luogo di default dell'**allievo** (REG-392, `defaultLocationId`)
2. luogo assegnato alla **patente della guida**
3. **sede** dell'autoscuola (`isDefault`)

La patente della guida è quella del **veicolo** se selezionato (è il veicolo a
definire che guida è: un allievo A2 su una moto A1 fa una guida A1), altrimenti
il percorso dell'allievo.

- `src/utils/locationForLicense.ts` è **gemello** di
  `../reglo/lib/autoscuole/location-for-license.ts` — stessa shape di
  `GET /api/autoscuole/locations`, stesse regole, **le due copie vanno cambiate
  insieme** (come `mandatoryLessons.ts` e `agendaColors.ts`).
- In `BookingForm` il ricalcolo scatta al cambio **allievo** (sempre, azzera la
  scelta manuale) e al cambio **veicolo** (solo se il Luogo non è stato scelto a
  mano); il picker Luogo alza `locationTouchedRef`.
- **Prenotazione dell'allievo dall'app**: non ha un campo Luogo: è il backend
  (`createBookingRequest` / `respondWaitlistOffer`) ad applicare la stessa
  precedenza. Prima andava sempre in sede. Vedi `../reglo/docs/features/locations.md`.

## Connected features
- **Booking Flow / Instructor Manage** — locations are pickable when creating/booking lessons (`LocationPickerSheet`, `InlineLocationPicker`, `IstruttoreHomeScreen` also call `getLocations`; they do not yet share `useLocations`)
- **Backend** — `getLocations`/`createLocation`/`updateLocation`/`deleteLocation`
