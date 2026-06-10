# Orari settimanali — disponibilità predefinita per-giorno (Airbnb, full-stack)

## Cosa è stato fatto (riepilogo)
Riprogettata la **modalità predefinita** della disponibilità istruttore come schermata Airbnb (`Orari settimanali`: lista verticale 7 giorni, una sola Fluent 3D come accento, icone a linea, divisori full-bleed, salva batch dirty-only). Resa possibile, end-to-end, l'impostazione di **orari diversi per ogni giorno** della settimana (prima il backend teneva un solo orario condiviso). Tolto il badge "Modalità predefinita" dallo shell (resta solo in pubblicazione). Web fuori scope, retro-compatibile.

## Backend (`reglo/`)
- **Schema**: aggiunto `AutoscuolaWeeklyAvailability.rangesByDay Json?` (additivo). Migrazione `20260605121341_add_ranges_by_day_weekly_availability` applicata al **dev DB**. Per prod: `pnpm migrate:prod` al deploy.
- **Action layer** (`lib/actions/autoscuole-availability.actions.ts`):
  - `AvailabilityRecord.rangesByDay?` + helper `parseRangesByDay`, `rangesForDay`, `narrowToDay`.
  - `defaultToAvailabilityRecord`: legge `rangesByDay` se presente, altrimenti legacy.
  - `resolveEffectiveAvailability` e `buildAvailabilityResolver().resolve`: **narrow** al giorno → tutti i consumatori esistenti (`isOwnerAvailable`/`isAvailabilityCovering` in slot-matcher, repositioning, swap) restano corretti senza modifiche.
  - `getAvailabilitySlots`: espansione per-giorno via `rangesForDay`.
  - `createAvailabilitySlots`: accetta `scheduleByDay`; persiste `rangesByDay` + deriva i campi legacy da un giorno rappresentativo. Save senza `scheduleByDay` azzera `rangesByDay` (torna al modello condiviso).
  - `getDefaultAvailability`: ritorna sempre `scheduleByDay` (i record legacy sono proiettati su ogni giorno attivo).
- Route invariate (pass-through del body). Doc: `reglo/docs/features/availability.md`.

## Mobile (`reglo-mobile/`)
- **Tipi/API** (`src/types/regloApi.ts`, `src/services/regloApi.ts`): `CreateAvailabilitySlotsInput.scheduleByDay?`, nuovo `DefaultAvailability` con `scheduleByDay`.
- **Cache** (`src/services/availabilityCache.ts`): base ora `{ scheduleByDay }` (`CachedBase`).
- **Schermata** (`src/screens/DefaultAvailabilityEditor.tsx`): riscritta come lista 7 righe Lun→Dom; ogni riga → sheet `role/publish-day` (riusato via `publishDayStore`) per toggle + `RangesEditor` del singolo giorno; CTA "Salva orari" dirty-only batch. Eccezioni invariate nel funzionamento, rifinite (nessuna Fluent, single-accent rule).
- **Shell** (`src/screens/InstructorAvailabilityScreen.tsx`): badge mostrato solo in pubblicazione.
- Doc: `docs/features/availability-editor.md`, `docs/impact-map.md`.

## Verifica
- `tsc` pulito su entrambi i repo (escluso il pre-esistente `autoscuole-quiz.actions.ts` non correlato e il legacy `TabNavigator`).
- Contratto `scheduleByDay` allineato backend↔mobile (chiavi numeriche → stringa via JSON → regex `^[0-6]$` lato zod).
- Cambiamento **behavior-preserving** per i record legacy (`narrowToDay` mantiene la forma risolta legacy). Le eccezioni (override giornalieri) vincono ancora sul base.

## Note / follow-up
- Nessun test automatico copre il resolver/booking: rete = ragionamento + `tsc`. Testare su **iPhone vero** (sheet, haptics, editing per-giorno, salvataggio).
- **Web** (editor default a orari condivisi): retro-compatibile via campo additivo, aggiornamento al per-giorno rimandato.
- Deploy: web/BE push→Vercel + `pnpm migrate:prod`; mobile OTA `eas update --platform ios --branch production` poi android.
