# Instructor Home — Daily View Redesign (Airbnb + design system)

## What was decided (user choices, 2026-06-06)
- **Slot liberi**: righe "libero" tappabili inline nell'itinerario → quick-book preimpostato. Si rimuove la modalità griglia coi drag.
- **Vista**: solo **Giorno** ora (Settimana dopo).
- **Scope**: solo home **Istruttore** (Titolare dopo).
- **Workflow**: iterazione su device, a fasi (no mock preview).
- **Empty state**: Fluent icon (`fluent-car` di default, eventualmente `duck-zen`).

## Target file
`src/screens/IstruttoreHomeScreen.tsx` (~7.8k righe). Preservare: stati guida, check-in/no-show inline, malattia, festivi, cluster vista titolare, scope toggle, logica creazione (quick-book/blocchi/collisioni).

## Phases
1. **Calendario nuovo** (basso) — route page-sheet `select-date` con `ScrollableMonthsCalendar` esteso (navigazione passato), sostituisce il `CalendarDrawer` dell'agenda. `dayPickerStore`.
2. **Timeline itinerario** (medio) — rail orario + linea, card Fluent, badge stato design system.
3. **Righe "libero" + quick-book** (medio) — gap liberi in disponibilità → righe tappabili → riuso sheet creazione esistente preimpostato. Rimozione griglia drag.
4. **Empty state Fluent** (basso).
5. **Polish** — FadeInUp staggered, haptics, skeleton, doc update.

## Notes / reference impls
- Airbnb scrollable calendar già in `booking-flow.tsx`; componente riusabile `src/components/ScrollableMonthsCalendar.tsx` (era future-only → esteso con `monthsBack`/`allowPast`).
- `bookedDatesSet` keys = `YYYY-M-D` (month 0-based, non padded); il nuovo calendario usa `YYYY-MM-DD` → costruire markedDates dedicato.
- Page sheet `presentation: 'modal'` per scroll variabile (memoria feedback_pagesheet_over_formsheet).

## Status
- [x] Fase 1 — Calendario nuovo (route `select-date`, `ScrollableMonthsCalendar` esteso passato, `dayPickerStore`)
- [x] Fase 2 — Timeline itinerario (rail con linea+nodo, card borderless ombra morbida, stato→pill)
- [x] Fase 3 — Slot liberi → drawer quick-book (stepper ±15min ora inizio), griglia tap+drag disattivata (`showLegacyGrid=false`)
- [x] Fase 4 — Empty state Fluent (`fluent-car`/`fluent-pin`) + CTA prenota
- [x] Fase 3b — Hold-to-scrub + formsheet nativo: `BookableBand` (long-press→pan, 15min/step, haptics, clamp), route nativa `quick-book` (`quickBookStore`), marker inizio/fine disponibilità, slot liberi su tutta la giornata, tap-fallback. Vecchio drawer custom ora morto (quickBookOpen mai più true).
- [ ] Fase 5 — Polish + rimozione codice morto (blocco griglia ~530 righe, drag handles, InlineCalendar/TimePicker se inutilizzati); swap calendario anche nel booking-flow guidato; home Titolare

## Note implementative
- `IstruttoreHomeScreen.tsx`: aggiunti `markedDatesYMD`, `openAgendaCalendar`, `showLegacyGrid` (flag non-letterale per non rompere il narrowing TS del blocco griglia disattivato).
- Drawer quick-book invariato nella logica (create guida/blocco, collisioni), ora si apre sopra l'itinerario; ora di inizio regolabile con stepper invece che col drag della griglia.
