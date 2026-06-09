# Migrazione "Malattia" + "Blocca slot" a route Modal (stile Nuova prenotazione)

**Stato:** approvato 2026-06-08, niente preview HTML (replica del design già approvato `new-booking`).

## Cosa si fa
Le due schermate istruttore "Malattia" (sick leave) e "Blocca slot" oggi sono `NativePageSheet` in-screen dentro `IstruttoreHomeScreen.tsx` con picker inline (`InlineCalendarPicker`/`InlineTimePicker`). Si migrano a **route Modal autonome** (`presentation:'modal'`) come `app/(tabs)/home/new-booking.tsx`, riusando i form sheet nativi esistenti (`select-date`/`dayPickerStore`, `time-picker`/`timePickerStore`).

## Fasi
1. **Store seed-and-callback**: `src/stores/blockSheetStore.ts`, `src/stores/sickLeaveSheetStore.ts` (modello `bookingSheetStore`). Seed `initialDate` + `onDone(message)` (parent: toast success + `loadData`). Errori gestiti in-route con `Alert` (come `new-booking`).
2. **Route Modal**: `app/(tabs)/home/block-slot.tsx`, `app/(tabs)/home/sick-leave.tsx`, registrate in `_layout.tsx`. Stile new-booking: X top-right, hero, card 3D bianche elevate con `Row`, banner N50 per i toggle, footer riepilogo + `Button loading`. Picker via form sheet nativi.
3. **IstruttoreHomeScreen**: `openBlockDrawer`/`openSickLeaveDrawer` → seed store + `router.push`. Rimossi i due `NativePageSheet`, stati `block*`/`sick*` e handler interni. Tenuto `handleDeleteBlock`. Rimossi `InlineCalendarPicker`/`InlineTimePicker` se non usati altrove + stili morti.
4. **Docs**: feature docs + handoff + memoria.

## Mappatura campi
- **Blocca slot**: Giorno/Ora inizio/Ora fine (card 3D, 3 Row → select-date + time-picker); Motivo (card TextInput); Ripeti ogni settimana (banner N50 + toggle → chip settimane [2/4/8/12]); CTA "Blocca slot".
- **Malattia**: Giorno singolo / DAL–AL (card 3D → select-date); Più giorni (banner N50 + toggle); Mezza giornata (banner N50 + toggle → Row Orario → time-picker); CTA "Conferma malattia".

## API invariata
- `regloApi.createInstructorBlock({ startsAt, endsAt, reason?, recurring?, recurringWeeks? })`
- `regloApi.createInstructorSickLeave({ startDate, endDate, startTime? })` → `{ blocksCreated, appointmentsCancelled }`
- `regloApi.deleteInstructorBlock(id)` (resta su tap blocco in agenda)

## Vincoli
mono-navy no rosa, weight 500/600, `Button.loading` (spinner), X top-right.

## Cosa è stato fatto (2026-06-08)
- **Nuovi store**: `src/stores/blockSheetStore.ts`, `src/stores/sickLeaveSheetStore.ts` (seed `initialDate` + `onDone(message)`).
- **Nuove route**: `app/(tabs)/home/block-slot.tsx`, `app/(tabs)/home/sick-leave.tsx`, registrate in `_layout.tsx`. **Form sheet nativo content-hugging** (`presentation:'formSheet'` + `sheetAllowedDetents:'fitToContents'`, NO ScrollView, root senza flex:1 — il contenuto è corto e su modal full-height lasciava un grosso vuoto). Stile: header titolo+X, card 3D `Row`, banner N50 per i toggle, footer riepilogo + `Button loading`. Picker via `select-date`/`time-picker` nativi. Errori in-route con `Alert`; validazione orario/periodo inline.
- **IstruttoreHomeScreen**: `openBlockDrawer`/`openSickLeaveDrawer` ora fanno solo `store.set(...)` + `router.push`. Rimossi i 2 `NativePageSheet` (~350 righe), gli stati `block*`/`sick*`, gli handler `handleCreateBlock`/`handleCreateSickLeave`, il componente morto `InlineCalendarPicker` (~94 righe), l'helper `normalizeToQuarter`, e 3 cluster di stili morti (`ctaButton*`, `blockRecurring*`/`blockWeek*`, `bookingField*`/`bookingSectionLabel`). **Tenuto** `handleDeleteBlock` e `InlineTimePicker` (usato dall'esame).
- Wiring FAB invariato (`FabMenu` → `homeAddSheetStore`). Type-check pulito.
- **Calendario range** (Malattia "Più giorni"): route `select-date-range.tsx` + `dateRangeStore` (tap inizio→fine su un solo calendario, sul modello di `more/hours-period`).
- **Optimistic update** (come le guide): infra blocchi `pendingBlocksRef`/`injectPendingBlocks`/`looseBlockKey`/`reconcileProvisionalBlocks` in IstruttoreHomeScreen; le route inseriscono i blocchi provvisori e dismissano prima della rete, reconcile/rollback al settle. Malattia rinfresca anche gli appuntamenti (guide cancellate spariscono).
- **DA TESTARE SUL DEVICE**: apertura da FAB, picker data/ora, blocco singolo + ricorrente, malattia singolo / range / mezza giornata, validazioni, **optimistic (il blocco/malattia compare subito, niente disappear/reappear), rollback su errore**, eliminazione blocco da agenda.
