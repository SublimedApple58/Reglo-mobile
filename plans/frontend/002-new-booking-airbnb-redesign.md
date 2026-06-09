# Redesign Airbnb — form "Nuova prenotazione"

> **Cosa è stato fatto (2026-06-08):** riscritto `app/(tabs)/home/new-booking.tsx` in stile Airbnb (opzione A, single-screen). Preview di riferimento approvata: `plans/frontend/new-booking-airbnb-A.html`. Type-check pulito. Da testare sul device.

## Decisione
Opzione **A — single-screen vestito Airbnb** (scartata la B, wizard a step). Tool da istruttore = la velocità conta, quindi stesso numero di tap di prima ma look Airbnb.

## Iterazione 2 (2026-06-08) — stile "Gestisci guida", card/righe 3D senza bordi
Su richiesta utente il form è stato riallineato a `manage-lesson.tsx`:
- **Titolo hero senza divider** ("Nuova prenotazione" 27/600 + sottotitolo grigio), niente più righe sotto al titolo né titoli-domanda per sezione.
- **Input = righe piatte dentro card bianche elevate** (ombra morbida, **NIENTE bordi**, radius 20): icona outline + label 15/600 + valore grigio `#717171` + chevron, divisori hairline solo tra le righe interne. Helper `Row` riusabile.
- **Luogo = form sheet dedicato riusato da manage-lesson**: `manage-lesson-location` (via `locationPickerStore` + `InlineLocationPicker`) + "crea luogo" → `manage-lesson-location-form` (via `locationFormStore`). Rimosso l'`InlineLocationPicker`/`Form` in-screen e tutto il sistema `mode`.
- **Durata / Veicolo / Tipo = righe → sheet di selezione generica** nuova: `app/(tabs)/home/select-options.tsx` + `src/stores/optionsPickerStore.ts` (formSheet `fitToContents`, single per Durata/Veicolo, multi per Tipo). Spariti i "pulsanti" SelectCard.
- **Multipla**: ogni guida è una card elevata (no bordi); chip data/ora aprono le sheet; durata come pill **filled-on-select** (navy pieno, no bordo). "Aggiungi guida" = card elevata.
- `SelectCard` e tutti i bordi rimossi dal form; superfici bianche + ombra (`ELEV`).

## Cosa cambia rispetto al form precedente
- **Titoli-domanda** grandi (h1 "Nuova prenotazione" 27px; sezioni "Per chi è la guida?", "Quando?", "Dove?", "Durata", "Veicolo", "Tipo di guida" 19px/600) al posto delle label grigie maiuscole.
- **Sezioni separate da hairline**, niente card bordate ovunque.
- **Allievo**: riga con avatar a iniziali + nome + sottotitolo + link "Cambia". Niente più `SearchableSelect` inline (l'utente non lo voleva): tap apre la **sheet nativa `select-student`** (route `presentation:'modal'` + `studentPickerStore`) con ricerca + lista avatar/spunta. Non selezionato → riga placeholder "Seleziona allievo" che apre la stessa sheet.
- **Durata / Veicolo / Tipo**: nuovo `SelectCard` locale, **bordo navy 2px sulla selezione** (no fill colorato), sostituisce i chip-row + `SelectableChip`.
- **Quando (single)**: due card "Giorno"/"Ora" che aprono le **sheet native condivise** — `select-date` (calendario `ScrollableMonthsCalendar` via `dayPickerStore`) e `time-picker` (ruota Ore/Minuti via `timePickerStore`). NIENTE accordion inline, NIENTE swap full-screen.
- **Calendario**: si riusa la route `select-date` esistente (quella dell'agenda). `markedDates` derivati da `bookedDateKeys` convertiti in YYYY-MM-DD (le chiavi arrivano come `y-monthIndex-day` 0-based non paddato). `monthsCount` derivato da `availabilityWeeks`, `allowPast:false`.
- **Orario**: nuova route `app/(tabs)/home/time-picker.tsx` (mirror di `role`/`settings`, pesi 600) registrata formSheet + `fitToContents` nel layout home.
- **Multipla**: ogni guida ha chip data/ora che aprono le **stesse sheet native** (seed dello store + callback che aggiorna la entry).
- **Luogo**: resta come swap full-area (`InlineLocationPicker`/`InlineLocationForm`) ma trigger presentato come riga Airbnb con icona pin + chevron.
- **Footer**: riepilogo a sinistra ("Gio 12 giu · 14:00 · 60 min" / "N guide") + CTA a destra (`Prenota guida` / `Prenota N guide`).

## Logica invariata
Store seed-and-callback `bookingSheetStore`, `confirmSingle`/`confirmMulti`, gestione `WEEKLY_LIMIT_CONFIRM`, reset su nuovo `data`, `typesPayload`, `normalizeToQuarter`.

## Note tecniche
- `mode` ridotto a `'form' | 'locationPicker' | 'locationForm'` (rimossi `'calendar' | 'timepicker'`).
- **`InlineCalendarPicker` e `InlineTimePicker` ELIMINATI** dal file (codice morto): la data/ora ora vivono nelle sheet native condivise. Questo risolve il TODO storico del de-dup picker *per new-booking*.
- Rimossi import/stati inutilizzati (`ActivityIndicator`, `radii`, `SelectableChip`, `Switch` nativo, `whenMode`, `editingEntryId/Field`).
- Nuova route `home/time-picker.tsx` + registrazione in `home/_layout.tsx`. `select-date` era già registrata.
- Weight 500/600 ovunque (no 700/800), mono-navy.

## TODO post-test
- Cleanup del codice morto del vecchio booking sheet in `IstruttoreHomeScreen.tsx` (handoff "Cleanup pendente").
