# Agenda istruttore / titolare (clay v2, REG-639)

La prima tab dell'app istruttore e titolare: le guide, gli esami, le guide di
gruppo, i blocchi e la disponibilità, in due viste — **Giorno** (predefinita,
una lista per orario) e **Settimana** (la griglia oraria). Rifatta nella notte
del 28/10/2026 (commit `de4124a` + correzioni `f1e6c94`), branch
`feat/reg-639-clay-ds`. Lo stile è il clay v2 (`docs/design-system.md` §0,
riassunto in §6.20).

> Storia: fino a REG-638 c'erano vista giorno a timeline (`itinCard`,
> `BookableBand`), `WeeklyOverview`, `WeeklyLiveCard`, `DayItinerary`,
> `home/day-detail`. REG-638 (28/10) le ha tolte lasciando solo la griglia;
> REG-639 ha aggiunto la nuova vista Giorno a lista. Dove gli altri feature doc
> citano quei componenti, sono storici.

## File

| File | Ruolo |
|------|-------|
| `src/screens/IstruttoreHomeScreen.tsx` | La schermata: dati (bootstrap agenda, disponibilità, festivi, fuori disponibilità), testata, scelta vista (`agendaView: 'day' \| 'week'`, parte da `'day'`), FAB «+», tutti i gestori di tocco (apri guida/esame/gruppo/blocco, quick-book). `ownerMode` = titolare puro in sola lettura. |
| `src/screens/TitolareHomeScreen.tsx` | Wrapper: `<IstruttoreHomeScreen ownerMode />`. |
| `src/components/agenda/AgendaDayStrip.tsx` | Striscia dei giorni lun–sab, a pagine settimanali (`FlatList` orizzontale, ±26 settimane). Giorno scelto nel cerchio nero clay, oggi in nero pieno, passati in grigio, sotto il numero di impegni in grigio (niente se zero). Segue il giorno scelto da fuori («Oggi», tocco in Settimana). Esporta `dateKeyOf(d)` (`YYYY-MM-DD`). |
| `src/components/agenda/AgendaDayView.tsx` | Vista Giorno. `buildItems` costruisce la sequenza del giorno: guide, esami (raggruppati per inizio/fine/istruttore), guide di gruppo (per `groupLessonId`), blocchi, **buchi liberi** e **«adesso»**; ordine per minuto, a parità «adesso» → eventi → buchi. Esami senza orario (`!endsAt`) in testa come «Esame, orario da definire». |
| `src/components/WeeklyAgendaView.tsx` | Vista Settimana (griglia). Nuova prop `onPressDay(day)` sull'intestazione del giorno. Colonne bianche col filetto, giorni in minuscolo, disponibilità come tinta appena accennata, blocchi istruttore neutri, linea dell'ora nera, link «Oggi» testuale. Blocco fantasma per prenotare invariato. |
| `src/utils/agendaLook.ts` | Aspetto di un evento per tutte e due le viste: `guideLook`, `EXAM_LOOK`, `GROUP_LOOK`, `GROUP_MOTO_LOOK`, `blockLabel`. Vedi [agenda-block-colors.md](agenda-block-colors.md). |
| `src/utils/agendaColors.ts` | Criterio colore + interruttori `AGENDA_BLOCK_BAR` e `NEUTRAL_BLUE`, `mixWithWhite`. |
| `app/(tabs)/home/add-action.tsx` | Foglio «Nuovo» del «+» (`FORM_SHEET` + `<FormSheet>`): `ClayList` di solo testo — Guida, Guida di gruppo (se `groupLessonsEnabled`), Esame, Lezione teorica, Blocca un orario, Malattia. Al tocco chiude e lancia l'azione a foglio chiuso (iOS +380 ms). Dati da `homeAddSheetStore`. |
| `app/(tabs)/home/quick-book.tsx` | Prenotazione veloce da buco libero / blocco fantasma: [quick-book.md](quick-book.md). |
| `src/components/InboxBellButton.tsx` (+ `AvailabilityButton`) | Campanella e orologio in testata (solo app istruttore, non `ownerMode`). |
| `src/theme/moraleArt.ts` | `MORALE_ART.espresso` per lo stato vuoto «Giornata libera». |

## Viste

**Testata** (stili `hd` in `IstruttoreHomeScreen`): «Agenda» 32/600, data
lunga in grigio con link «Oggi» se il giorno scelto non è oggi, orologio +
campanella a destra; per il `INSTRUCTOR_OWNER` le due voci di testo «Le mie
guide» / «Tutti gli istruttori» (`calendarScope`); `ClaySegmented` Giorno |
Settimana (`testID` `agenda-view-day` / `agenda-view-week`); errore; banner
fuori disponibilità (`ClaySurface` → `home/out-of-availability`).

**Giorno** (`AgendaDayView`):
- guida = `EventCard` bianca clay con barretta + tinta (`guideLook`), nome
  allievo («Cognome Nome») e riga grigia: stato (Assente / In corso), tipo
  (o tipo moto birilli/strada), durata, veicolo se `agendaShowVehicle`;
- esame = barretta nera, «Esame» + «N allievi · nomi»; gruppo = barretta verde
  (ambra se moto), «Guida di gruppo» + «N su capienza · nomi»;
- blocchi (pausa, blocco, malattia, ferie, teoria) = righe quiete grigie con
  filetto, la pausa tra guide (`lesson_buffer`) si legge «Pausa»; tappabili
  (`handlePressBlock`) tranne in `ownerMode`;
- **buchi liberi**: dentro le finestre di disponibilità del giorno, solo nel
  futuro (oggi dall'ora corrente arrotondata a 15'), almeno 30 min → riga
  tratteggiata «Libero · hh:mm–hh:mm · durata», tocco →
  `onBookAt(date, start, start, end)` → `openQuickBookSheet`. Calcolati solo se
  c'è `onBookAt`: niente buchi per `ownerMode`, senza permesso di prenotare
  (`canInstructorBook`) o con «Tutti gli istruttori»;
- **«adesso»**: filetto nero con pallino e ora, solo oggi; un timer al minuto
  sposta «adesso» e i buchi;
- titolare / «Tutti gli istruttori» (`groupByInstructor`): sezioni per
  istruttore in ordine alfabetico, senza blocchi né buchi, ricerca
  (`ClaySearchField`) oltre 5 istruttori;
- vuoto = `ClayEmpty` espresso «Giornata libera» (testo diverso se festivo o se
  si può prenotare); in caricamento tre schede-scheletro;
- pull-to-refresh → `handleRefresh`; spazio in fondo 150 pt per il FAB.

**Settimana** (`WeeklyAgendaView`): la griglia di sempre ripulita in clay (vedi
design-system §6.20). Tocco sull'intestazione di un giorno →
`setSelectedDate(d)` + `setAgendaView('day')`. Lo swipe di settimana aggiorna
`selectedDate` solo se cambia settimana (`onDateChange`).

Il cambio vista e il cambio giorno usano `SOFT_SWAP_IN` / `SOFT_SWAP_OUT`
(`utils/motion.ts`): dissolvenza, niente rimbalzi.

## Flusso dati

```
IstruttoreHomeScreen
 ├─ useAgendaBootstrap(from/to = loadRange, instructorId per scope) ─► appointments, instructorBlocks, students, vehicles
 ├─ useAutoscuolaSettings / instructor settings / festivi ─────────────► settings, holidays
 ├─ disponibilità: 21 × getAvailabilitySlots (settimana prima, corrente, dopo) ─► weekAvailability[YYYY-MM-DD]
 ├─ dayCounts (impegni per giorno, esami e gruppi contati una volta, annullate escluse)
 │
 ├─ agendaView === 'day'
 │    ├─ AgendaDayStrip(selected, counts = dayCounts, holidays)
 │    └─ AgendaDayView(date, appointments, instructorBlocks,
 │                     availability = weekAvailability[dateKeyOf(selectedDate)],
 │                     holiday, groupByInstructor = ownerMode || scope 'all', …)
 └─ agendaView === 'week'
      └─ WeeklyAgendaView(appointments, instructorBlocks, holidays, anchorDate = selectedDate,
                          weekAvailabilityByDate = weekAvailability, onPressDay, …)
```

- Le due viste ricevono **gli stessi dati**: il bootstrap copre una finestra
  mobile (`loadRange`, ~7 giorni indietro fino all'orizzonte di prenotazione)
  scollegata dal giorno mostrato; ogni vista filtra lato client. Cambiare
  giorno nella vista Giorno non costa rete.
- **Disponibilità per settimana (cambio REG-639)**: l'effetto che scarica le
  21 giornate di disponibilità dipende ora da `selectedWeekKey` (il lunedì del
  giorno scelto) e da `instructorId`, **non più da `selectedDate`**. Nella
  vista Giorno si cambia giorno a ogni tocco: con la dipendenza dal giorno
  partivano 21 chiamate ogni volta. Il risultato si **fonde** con quello già in
  memoria (mai rimpiazzato, mai svuotato su errore).
- Gestori condivisi dalle due viste: `openLessonDrawer` (guida →
  `manage-lesson`, o `manage-group-lesson` se è una riga di gruppo),
  `openExamFromAgenda` (→ `exam-manage`, unione dei colleghi su tutte le righe,
  REG-585), `openGroupLessonManage`, `handlePressBlock`, `openQuickBookSheet`.
  Tutti i fogli di arrivo sono `FORM_SHEET` + `<FormSheet>` (design-system
  §13.2).

## Regole / gotcha

- Il titolare puro (`ownerMode`) è in sola lettura: niente FAB, niente buchi
  liberi, blocchi non tappabili, fogli in `readOnly`.
- Il colore dei blocchi passa SOLO da `agendaLook` (non duplicare la logica
  nelle viste). `NEUTRAL_BLUE` è una decisione della notte **da confermare con
  Tiziano** (e oggi neutralizza anche il viola: vedi
  [agenda-block-colors.md](agenda-block-colors.md)).
- `dateKeyOf` di `AgendaDayStrip` è la chiave locale `YYYY-MM-DD` usata anche
  per `weekAvailability`, `holidays` e `dayCounts`: non mescolarla con chiavi
  UTC.
- Il FAB è un cerchio nero 56 con `CLAY_CTA.primary` (`testID="agenda-fab"`);
  si nasconde mentre è attiva la CTA del blocco fantasma
  (`onGhostActiveChange`).

## Connessioni

- [quick-book.md](quick-book.md) — prenotazione da buco libero / blocco fantasma.
- [agenda-block-colors.md](agenda-block-colors.md) — colore dei blocchi.
- [group-lessons.md](group-lessons.md), [exam-creation.md](exam-creation.md),
  [exam-outcome.md](exam-outcome.md), [lezione-teorica.md](lezione-teorica.md),
  [instructor-manage.md](instructor-manage.md) — i fogli che si aprono dall'agenda.
- [availability-editor.md](availability-editor.md) — fonte delle finestre di
  disponibilità (buchi liberi, tinta della griglia); si apre dall'orologio.
- [notifications.md](notifications.md) — campanella in testata.
