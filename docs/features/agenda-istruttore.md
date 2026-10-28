# Agenda istruttore / titolare (clay v2, REG-639)

La prima tab dell'app istruttore e titolare: guide, esami, guide di gruppo,
blocchi e disponibilità in **una sola vista, la Settimana** (la griglia oraria
lun–sab), come dopo REG-638. REG-639 ne ha rifatto lo stile (clay v2:
`docs/design-system.md` §0, riassunto in §6.20), non la struttura.

> Storia: la notte del 28/10 era stata aggiunta una vista Giorno a lista
> (`AgendaDayView` + `AgendaDayStrip`, commit `de4124a`) con la barretta di
> colore sui blocchi. Tiziano l'ha bocciata il 29/10: **solo Settimana**, blocchi
> a **riempimento pastello pieno** (commit `7361d96`). I componenti della vista
> Giorno sono stati eliminati; dove altri doc li citano, sono storici. Prima
> ancora (fino a REG-638) c'erano `itinCard`, `BookableBand`, `WeeklyOverview`,
> `WeeklyLiveCard`, `DayItinerary`, `home/day-detail`: tutti eliminati.

## File

| File | Ruolo |
|------|-------|
| `src/screens/IstruttoreHomeScreen.tsx` | La schermata: dati (bootstrap agenda, disponibilità, festivi, fuori disponibilità), testata clay, FAB «+», tutti i gestori di tocco (apri guida/esame/gruppo/blocco, quick-book). `ownerMode` = titolare puro in sola lettura. |
| `src/screens/TitolareHomeScreen.tsx` | Wrapper: `<IstruttoreHomeScreen ownerMode />`. |
| `src/components/WeeklyAgendaView.tsx` | La griglia settimanale: settimane affiancate a scorrimento, colonne bianche col filetto, giorni in minuscolo, disponibilità come tinta appena accennata, blocchi istruttore neutri, linea dell'ora nera, link «Oggi» testuale, blocco fantasma per prenotare. L'intestazione dei giorni NON è tappabile (come prima). |
| `src/utils/agendaLook.ts` | Aspetto di un evento (un solo punto): `guideLook`, `EXAM_LOOK`, `GROUP_LOOK`, `GROUP_MOTO_LOOK`, `blockLabel`. Vedi [agenda-block-colors.md](agenda-block-colors.md). |
| `src/utils/agendaColors.ts` | Criterio colore (da «Aspetto agenda») + interruttore `AGENDA_BLOCK_BAR` (oggi `false`), `mixWithWhite`. |
| `app/(tabs)/home/add-action.tsx` | Foglio «Nuovo» del «+» (`FORM_SHEET` + `<FormSheet>`): `ClayList` di solo testo — Guida, Guida di gruppo (se `groupLessonsEnabled`), Esame, Lezione teorica, Blocca un orario, Malattia. Al tocco chiude e lancia l'azione a foglio chiuso (iOS +380 ms). Dati da `homeAddSheetStore`. |
| `app/(tabs)/home/quick-book.tsx` | Prenotazione veloce dal blocco fantasma della griglia: [quick-book.md](quick-book.md). |
| `src/components/InboxBellButton.tsx` (+ `AvailabilityButton`) | Campanella e orologio in testata (solo app istruttore, non `ownerMode`), cerchi bianchi clay `raiseSm`. |

## La vista

**Testata** (stili `hd` in `IstruttoreHomeScreen`): «Agenda» 32/600 con sotto
la data di oggi in grigio; a destra orologio (Disponibilità) e campanella; per
il `INSTRUCTOR_OWNER` due voci di testo «Le mie guide» / «Tutti gli istruttori»
(`calendarScope`, niente chip); errore; banner «N guide fuori disponibilità»
(`ClaySurface` piccola → `home/out-of-availability`). Niente segmentato:
l'agenda si apre e resta sulla Settimana.

**Settimana** (`WeeklyAgendaView`):
- intestazione con l'intervallo («26 – 31 Ott») e il link testuale «Oggi»
  quando si è su un'altra settimana;
- giorni `lun`…`sab` in minuscolo, oggi nel cerchio nero, passati in grigio,
  festivi grigi barrati;
- colonne bianche separate da un filetto; la disponibilità è una tinta di fondo
  appena accennata (`rgba(17,17,17,0.028)`);
- **guide**: blocco a **fondo pieno in tinta pastello** (il colore scelto
  dall'autoscuola, ammorbidito da `softenTint`), **senza bordo** né barretta,
  **ombra morbida nella stessa tinta** (`tintShadow`), testo scuro. Cambio
  automatico: bordo REG-622 (impostazione di prodotto). Annullate/assenti: grigio
  tenue. Esame il giorno dopo: rosso pastello;
- esami: fondo bianco con ombra neutra; guide di gruppo: verde foglia pastello,
  gruppi moto: ambra pastello, ombra in tinta;
- blocchi istruttore (pausa, blocco, malattia, ferie): bianchi tratteggiati in
  grigio, senza icona; la pausa tra guide (`lesson_buffer`) si legge «Pausa»;
  lezione teorica piena;
- esami senza orario: card bianca clay sopra la griglia («Esame · giorno»);
- linea dell'ora nera sulla colonna di oggi;
- tocco/trascinamento su uno spazio libero → blocco fantasma → «Scegli i
  dettagli» → quick-book.

**FAB «+»**: cerchio nero 56 col volume della CTA primaria
(`CLAY_CTA.primary`, `testID="agenda-fab"`) → foglio «Nuovo». Si nasconde mentre
è attiva la CTA del blocco fantasma (`onGhostActiveChange`).

## Flusso dati

```
IstruttoreHomeScreen
 ├─ useAgendaBootstrap(from/to = loadRange, instructorId per scope) ─► appointments, instructorBlocks, students, vehicles
 ├─ useAutoscuolaSettings / instructor settings / festivi ─────────────► settings, holidays
 ├─ disponibilità: 21 × getAvailabilitySlots (settimana prima, corrente, dopo) ─► weekAvailability[YYYY-MM-DD]
 └─ WeeklyAgendaView(appointments, instructorBlocks, holidays, anchorDate = selectedDate,
                     weekAvailabilityByDate = weekAvailability, onBookAt, …)
```

- Il bootstrap copre una finestra mobile (`loadRange`, ~7 giorni indietro fino
  all'orizzonte di prenotazione); la griglia filtra lato client.
- **Disponibilità per settimana (REG-639)**: l'effetto che scarica le 21
  giornate dipende da `selectedWeekKey` (il lunedì della settimana mostrata) e da
  `instructorId`, non da `selectedDate`. Il risultato si **fonde** con quello
  già in memoria (mai rimpiazzato, mai svuotato su errore).
- Lo swipe di settimana aggiorna `selectedDate` solo se cambia settimana
  (`onDateChange`).
- Gestori: `openLessonDrawer` (guida → `manage-lesson`, o `manage-group-lesson`
  se è una riga di gruppo), `openExamFromAgenda` (→ `exam-manage`, unione dei
  colleghi su tutte le righe, REG-585), `openGroupLessonManage`,
  `handlePressBlock`, `openQuickBookSheet`. Tutti i fogli di arrivo sono
  `FORM_SHEET` + `<FormSheet>` (design-system §13.2).

## Regole / gotcha

- Il titolare puro (`ownerMode`) è in sola lettura: niente FAB, niente blocco
  fantasma, blocchi non tappabili, fogli in `readOnly`.
- Il colore dei blocchi passa SOLO da `agendaLook` (non duplicare la logica
  nella griglia).
- **Colori = «Aspetto agenda»**: i blocchi usano **esattamente il colore scelto in «Aspetto agenda»** dall'autoscuola (anche blu/azzurro), a fondo pastello pieno — decisione di Tiziano del 29/10 («i colori devono rispettare i setting Aspetto agenda»). La regola `NEUTRAL_BLUE` provata la notte del 28/10 è stata eliminata.

## Connessioni

- [quick-book.md](quick-book.md) — prenotazione dal blocco fantasma.
- [agenda-block-colors.md](agenda-block-colors.md) — colore dei blocchi.
- [group-lessons.md](group-lessons.md), [exam-creation.md](exam-creation.md),
  [exam-outcome.md](exam-outcome.md), [lezione-teorica.md](lezione-teorica.md),
  [instructor-manage.md](instructor-manage.md) — i fogli che si aprono dall'agenda.
- [availability-editor.md](availability-editor.md) — fonte della tinta di
  disponibilità; si apre dall'orologio.
- [notifications.md](notifications.md) — campanella in testata.
