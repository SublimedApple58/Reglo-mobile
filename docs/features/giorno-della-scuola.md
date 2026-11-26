# Giorno della scuola — agenda «Tutti» a colonne-istruttore (REG-794)

L'agenda di **tutti gli istruttori** per il titolare e il titolare-istruttore.
Ha sostituito la settimana «Tutti gli istruttori» (tutti nella stessa colonna
del giorno, corsie da 16 pt con le iniziali: illeggibile, REG-763).

È il **concetto A** delle anteprime del 26/11 (`/tmp/hiro-anteprime/reg-794/`):
una colonna per istruttore a larghezza fissa che scorre in orizzontale, come la
vista Giorno della web app su telefono. Primo rilascio di REG-794; il secondo
porterà «Oggi» e le tab nuove del titolare.

## Chi lo vede

| Ruolo | Agenda |
|---|---|
| Titolare puro (`OWNER`, `TitolareHomeScreen` = `ownerMode`) | sempre il giorno della scuola; tocco su un nome → la settimana di quell'istruttore |
| Titolare-istruttore (`INSTRUCTOR_OWNER`) | segmentato nativo **«La mia · Tutti»** in testa: «La mia» = la sua settimana di sempre, «Tutti» = il giorno della scuola; il tocco sulla colonna «Tu» torna a «La mia» |
| Istruttore | invariato: solo la sua settimana |

## File

| File | Ruolo |
|---|---|
| `src/components/schoolDay/types.ts` | **Contratto comune** `SchoolDayViewProps` (dati del giorno + gestori). Qualunque vista del giorno (A colonne, B timeline, C elenco) lo implementa. |
| `src/components/schoolDay/index.ts` | **Punto di scambio**: `SchoolDayView` = `SchoolDayColumns`. Per provare B o C si scrive la vista con le stesse props e si cambia solo questo export. |
| `src/components/schoolDay/schoolDayModel.ts` | Puro, senza React: `orderInstructors` («Tu» per primo, poi `agendaInstructorOrder` del web, poi alfabetico, niente disattivati), `buildSchoolDay` (guide, esami raccolti per fascia, gruppi, blocchi, esami senza orario, `lessonCount`, assenza di giornata), `mergeAvailabilitySlots`, `mondayOf`, `toDateKey`. |
| `src/components/schoolDay/SchoolDayColumns.tsx` | Vista A. Colonne da 132 pt, ora = 60 pt, griglia 07–24, colonna delle ore (44 pt) ferma a sinistra, fila dei volti ferma in alto che segue lo scorrimento orizzontale sul thread UI (`useAnimatedScrollHandler` → `translateX`). Si montano solo le colonne vicine a quelle in vista (finestra a mano). Colonne `React.memo`, blocchi memo, una sola ombra per blocco. |
| `src/components/schoolDay/SchoolDayStrip.tsx` | Striscia della settimana: giorno a parole, a destra «N guide» o «Oggi»; lun–sab, giorno scelto nel cerchio nero; si scorre di settimana col dito (stesso giorno della settimana). Comune a tutte le viste. |
| `src/hooks/queries/useSchoolAvailability.ts` | Disponibilità di TUTTI gli istruttori per la settimana mostrata: una chiamata `GET agenda/availability?from=lunedì&to=lunedì dopo` (REG-795, fasce identiche al web), cache 5', settimane vicine precaricate. Se la rotta risponde 404 (backend vecchio) ripiega su `availability/slots` senza `ownerId` per tutta la sessione. Usata anche da «Oggi» ([oggi-titolare.md](oggi-titolare.md)). |
| `src/components/agenda/ghost.tsx` | Il fantasma (bozza, superfici di tocco, barra «Guida ⌄ · Continua»), condiviso con `WeeklyAgendaView` e parametrizzato dalla geometria (`GhostGeometry`) e da cosa è una colonna (`GhostColumn`: giorno + istruttore). |
| `src/components/NativeSegmented.tsx` | Segmentato nativo iOS (`@expo/ui`), ripiego `ClaySegmented`. |
| `src/screens/IstruttoreHomeScreen.tsx` | Scope `personal` / `all` / `instructor` (settimana di un istruttore scelto), testata, striscia, scambio fra `SchoolDayView` e `WeeklyAgendaView`, creazione per colonna (`handleCreateAt`). |

## Comportamento

- **Blocchi**: stessi colori di sempre (`agendaLook`, «Aspetto agenda»).
  - Guida: nome e cognome, orario (o «Assente» in rosso), mezzo se l'autoscuola lo mostra (`agendaShowVehicle`).
  - Esame bianco: «Esame», allievi e ora.
  - Gruppi verde e ambra: «Guida di gruppo», posti e ora.
  - Blocchi tratteggiati: «Pausa», «Malattia» ecc.
  - Sovrapposizioni dello stesso istruttore: corsie (`layoutLanes`, minimo 40 pt) e «+N» → `home/agenda-slot`.
- **Testata colonna**: volto, «Sara B.» o «Tu», «9 guide», «Nessuna guida», «Malattia» o «Ferie». Il tocco apre la settimana di quell'istruttore: testata con indietro, volto, nome e «N guide in questa settimana». La settimana usa `WeeklyAgendaView` filtrata in memoria, con la disponibilità di quell'istruttore.
- **Linea dell'ora** nera su tutte le colonne, con l'ora nella colonna delle ore. All'apertura e a ogni cambio di giorno lo scorrimento va un'ora prima di adesso (oggi) o alla prima guida.
- **Esami senza orario** e **festivo**: una riga di testo sopra le colonne.
- **Creazione**: il fantasma crea **per l'istruttore della colonna**.
  - Guida: `bookingSheetStore.instructorId` = colonna, con `instructorFromColumn`, quindi non passa all'istruttore assegnato all'allievo.
  - Blocco, teoria e gruppo: `presetInstructorId`.
  - Per un collega (o per il titolare) i fogli mostrano la riga «Istruttore» già scelta.
  - La barra dice di chi è la colonna: «Gio 26 nov · 13:00 – 14:00 · Marta». Lo stesso nella settimana di un collega (`WeeklyAgendaView.ghostInstructorName`).
  - Per un collega il primo foglio della guida chiede «Con chi guida Marta?» invece di «Con chi guidi?» (`bookingSheetStore.columnInstructorName`).
  - Esame: `examSheetStore.instructorId` = colonna (REG-795), il sottotitolo dice «· Marco» per un collega.
- **Disponibilità**: tinta appena accennata per colonna, dall'hook sopra. Dal 26/11 (rilascio 2) viene da `agenda/availability` di REG-795, identica al web. Il ripiego su `availability/slots`, che non conosce le settimane pubblicate né i luoghi, resta solo per un backend senza la rotta.
- **Dati**: nessuna chiamata nuova al tocco. Gli impegni sono quelli del bootstrap «Tutti» già caricato (finestra −7/+35 giorni, paginato); cambiare giorno filtra in memoria.

## Regole / gotcha

- Il titolare puro **agisce come sul web** dal rilascio 2: fogli guida, esame e gruppo senza `readOnly`, blocchi tappabili. Lo permette l'audit dei permessi di REG-795 (`reglo/docs/features/owner-mobile-agenda.md`). Non ha il FAB «+»: crea dal fantasma.
- Il FAB «+» (titolare-istruttore) crea per sé; non c'è nella settimana di un collega.
- `WeeklyAgendaView` non mostra più più istruttori insieme: `showInstructor` resta come prop ma la schermata non la accende.
