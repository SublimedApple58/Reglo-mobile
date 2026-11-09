# Exam Creation

> **REG-604 — creare un esame ora avvisa l'allievo.** Prima era muto su tutti
> i canali (non esisteva nessun `appointment_created` in tutto il prodotto).
> Ora `createExamEvent` e `addExamStudent` mandano «🎓 Esame fissato», e
> `updateExamTime` manda «🎓 Orario dell'esame definito» quando l'esame passa
> da senza-orario a con-orario. Un esame creato **senza orario** riceve
> comunque la notifica, senza l'orario dentro. Vedi
> [notifications.md](notifications.md) e, lato backend,
> `reglo/lib/autoscuole/exam-notifications.ts`.

## What it does
Create exam appointments for zero or more students at once. Un esame si può creare **senza allievi** (spesso l'autoscuola non sa subito chi parteciperà) e riempirlo dopo dal foglio di gestione.

## Key files
- `src/screens/CreateExamScreen.tsx` (22KB) — crea l'esame (0+ allievi)
- `app/(tabs)/home/exam-manage.tsx` — foglio "Esame di guida": aggiungi/rimuovi allievi, cambia orario, esaminatori, note, annulla
- `app/(tabs)/home/exam-examiners.tsx`, `app/(tabs)/home/exam-notes.tsx` — fogli esaminatori e note (REG-640)
- `src/utils/weeklyAgenda.ts` — `isExamPlaceholder()` + conteggi esame

## Features
- Multi-student selection grouped by cluster ("Mio gruppo", "Altro gruppo", unassigned)
- **Zero allievi ammessi (2026-07-16)**: il tasto "Crea esame" non richiede più almeno un allievo; l'esame vuoto compare in agenda come "Nessun allievo" e si riempie toccandolo → `+`. Modello backend = riga segnaposto `studentId=null` convertita al primo allievo (vedi `../reglo` appointments.md, `materializeExamSlot`). Sul mobile un segnaposto è `type==='esame' && !studentId` (`isExamPlaceholder`), escluso da conteggi/liste in `exam-manage`, `IstruttoreHomeScreen`, `WeeklyLiveCard`, `WeeklyAgendaView`.
- Searchable student picker with smart sorting (selected first, then cluster)
- Date, start/end time selection (default 1h)
- Optional exam notes
- **Esaminatori e note (REG-640, richiesta Solferino)**: prima riga di «Crea esame» = «Esaminatori» → form sheet `home/exam-examiners` (`src/stores/examinersSheetStore.ts`, `cleanExaminers`): righe di nome con la X, «Aggiungi esaminatore» quando l'ultima è compilata (max 5), sezione «Già usati» con i nomi dell'autoscuola (`getExamExaminerSuggestions`). Persone esterne, non istruttori: nomi liberi. In `exam-manage` la riga «Esaminatori» e la sezione «Note» (prima solo lettura) aprono `home/exam-examiners` e `home/exam-notes` (`examNotesSheetStore`) e salvano con `updateExamDetails` su **tutte** le righe dell'esame, segnaposto compreso; stato locale aggiornato a risposta del BE. Il titolare (`readOnly`) li vede solo. Aggiungendo allievi si rimandano note ed esaminatori correnti; il BE comunque li eredita dallo slot se mancano.

## API functions used
`getStudents`, `getInstructorSettings`, `createExam`, `updateExamDetails`, `getExamExaminerSuggestions`

## Components used
Screen, BottomSheet, CalendarDrawer, TimePickerDrawer

## Connected features
- **Booking Flow** — exam is a special appointment type
- **Settings** — reads cluster config for student grouping
