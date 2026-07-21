# Lezione teorica (agenda)

## What it does
Blocco "Lezione teorica" nell'agenda istruttore: occupa una fascia oraria e la
rende **non prenotabile** (nessuno slot allievo, nessuna guida/esame/gruppo
sovrapponibile). Su mobile l'istruttore la **crea per sé** e la **visualizza**;
la creazione per un altro istruttore resta sul web. Backend = un
`AutoscuolaInstructorBlock` con `reason:"theory_lesson"` (vedi
`../../reglo/docs/features/lezione-teorica.md`).

## Data model / API
Tipo `InstructorBlock` (`src/types/regloApi.ts`), `reason: "theory_lesson"`, con
il nuovo campo `description: string | null` (descrizione libera opzionale, comune
a teorica e blocco generico).
- **Creazione**: `regloApi.createInstructorBlock` → `POST /api/autoscuole/instructor-blocks`.
- **Modifica**: `regloApi.updateInstructorBlock(blockId, input)` →
  `PATCH /api/autoscuole/instructor-blocks/:id` (orario e/o descrizione; blocco
  singolo, niente ricorrenza). `UpdateInstructorBlockInput` in `regloApi.ts`.
- **Eliminazione**: `regloApi.deleteInstructorBlock`.

## Modifica + descrizione (mobile)
- `blockSheetStore` porta `blockId?` (→ modalità edit), `reason?`, `description?`
  per fare il seed del form.
- `BlockForm.tsx`: campo **Descrizione (facoltativa)** (`TextInput` multiline,
  stile `s.textArea`) mostrato anche per la teorica; in edit chiama
  `updateInstructorBlock` (CTA "Salva") e mostra un bottone **Elimina**; la
  ricorrenza è nascosta.
- **Entry point modifica**: tap su un blocco in agenda ora apre il form in edit
  (`openBlockEdit`/`handlePressBlock` in `IstruttoreHomeScreen`) invece
  dell'alert di eliminazione — per teorica e generico; malattia/ferie restano
  con l'alert di rimozione (flussi propri). Vale per le 3 superfici
  (`theoryItinCard`, `WeeklyAgendaView` grid `onPressBlock`, `DayItinerary`
  `onOpenBlock`).

## Key files
- `src/utils/weeklyAgenda.ts` — `BlockKind` esteso con `'theory'`; `blockKindOf`
  mappa `theory_lesson`; `BLOCK_PRESENTATION.theory` (indaco `#E6E9FF`/`#3730a3`,
  icona `book`).
- **Creazione** (riusa il flusso "Blocca slot"): `src/stores/blockSheetStore.ts`
  (campo `kind: 'generic' | 'theory'`), `src/components/booking/BlockForm.tsx`
  (branch `isTheory`: titolo, forza reason, avviso bloccante, niente motivo,
  label "Crea lezione"), route `app/(tabs)/home/theory-lesson.tsx`
  (registrata `TALL_SHEET` in `home/_layout.tsx`), voce nel menu ＋
  (`home/add-action.tsx` + `homeAddSheetStore.onTheory`), `IstruttoreHomeScreen`
  (`openTheoryDrawer`, `seedBlockStore(..., 'theory')`).
- **Rendering** (3 superfici, card piena in tinta come esame/gruppo, NON muted):
  - `src/screens/IstruttoreHomeScreen.tsx` — giornaliera inline (`theoryItinCard`)
    + **dot** calendario (`theoryDateKeys` → `dayPillTheoryDot`).
  - `src/components/DayItinerary.tsx` — day-detail (`theoryCard`, icona `study-books`).
  - `src/components/WeeklyAgendaView.tsx` — griglia: rettangolo pieno indaco
    (`blockSolid`, niente bordo tratteggiato, niente icona per non coprire il titolo).

## Colour
Indaco `#E6E9FF` bg, `#3730a3`/`#4F46E5` testo/accento. Coordinato col web (là con
righe diagonali; su RN tinta piena). Distinto da esame (viola), gruppo (teal/arancio).

## Connected features
- **Instructor Hours (Ore di guida)** — le ore teoriche compaiono nel report come
  categoria separata (`InstructorHoursRange.total.theoryMinutes` +
  `buckets[].theoryMinutes`, card indaco in `InstructorHoursScreen`). Backend:
  `getInstructorDrivingHoursRange` somma i block `theory_lesson`.
- **Quick-book** — condivide `BlockForm`/`blockSheetStore`; la teorica NON è nel
  segmentato quick-book (solo menu ＋), come Malattia.
- **Instructor Manage** — stesso rendering dei blocchi; la teorica ha card piena
  (evento), non lo stile muted delle assenze.
- **Backend** — nessuna modifica: passa dai check di disponibilità esistenti.
