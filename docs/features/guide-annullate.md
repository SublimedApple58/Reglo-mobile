# Le tue guide (vista allievo)

> Prima si chiamava "Guide annullate": dal 23/09/2026 (REG-510) la vista copre
> **tutto lo storico**, non solo gli annullamenti.

## Cosa fa
Vista "Le tue guide" lato **allievo** con quattro filtri: **Tutte · Programmate ·
Svolte · Annullate**. Raggruppate per mese (più recenti in alto), con badge di
stato e — per le annullate — lo stato della penale (tardiva / addebitata / non
addebitata).

## File chiave
- `src/components/LessonsOverview.tsx` — componente condiviso (segmentato + liste + badge). Prop: `studentId`, `seededUpcoming?`, `onOpenDetail?`.
- `app/(tabs)/home/all-lessons.tsx` — accesso dalla **home** (sheet, `TALL_SHEET`): legge `allLessonsStore` (seed + callback), card programmate **tappabili** → `onOpenDetail`.
- `app/(tabs)/settings/le-tue-guide.tsx` — accesso **durevole** dal Profilo allievo (tab Impostazioni): modalità **autonoma**, card programmate **non** tappabili. Registrato in `app/(tabs)/settings/_layout.tsx` (`TALL_SHEET`).
- `src/screens/SettingsScreen.tsx` — voce **"Le tue guide"** nel `renderStudentContent` (gruppo preferenze, sopra Disponibilità), route `settings/le-tue-guide`. L'allievo non vede `MoreScreen`/"Altro".
- `src/stores/allLessonsStore.ts` — store seed-and-callback della home; ora porta anche `studentId` (serve al segmento Annullate per il fetch storico).
- `src/types/regloApi.ts` — `AutoscuolaAppointment` esteso con `cancelledAt`, `penaltyAmount`, `penaltyCutoffAt`, `lateCancellationAction`.

## Comportamento
- **Una sola query** (REG-510) per tutto: `useAppointments` con `from` a −36 mesi,
  `to` a +84 giorni, `light`, `limit:400`. I quattro filtri lavorano sullo stesso
  risultato, quindi **cambiare filtro è istantaneo** — ed è la condizione perché
  la transizione si possa animare: con le query pigre di prima ogni cambio
  sarebbe stato interrotto da uno spinner. Per un allievo sono decine di righe.
- **Tutte**: programmate + svolte + non presentato + annullate dall'allievo.
- **Programmate**: futuro con status `scheduled/confirmed/checked_in/pending_review`.
  In home le seedate (`seededUpcoming`) dipingono la lista al primo frame,
  mentre lo storico arriva.
- **Svolte**: `status === 'completed'`.
- **Annullate**: `cancellationKind === 'manual_cancel'` → escludono le rimozioni
  amministrative (`record_cleanup`) e gli annullamenti organizzativi della
  scuola. Regola invariata da prima di REG-510.
- **Non presentato** (`no_show`): compare **solo** in "Tutte", con badge proprio.
  Non sta sotto "Svolte" perché quella guida non è stata svolta.

## Perché lo storico non si vedeva (REG-510)
Segnalato da Scuola Guida Ricca come «le guide importate dal vecchio gestionale
non si vedono, quelle normali sì». **L'inserimento retroattivo non c'entrava**:
sui dati di produzione le 16 guide "normali" e le 11 importate erano tutte
`completed` e passate, identiche a parte `createdAt`, che nessuna query guarda.

La causa era la **finestra temporale**: la Home dell'allievo chiede da
`oggi − 7 giorni`, e questa vista non chiedeva mai guide passate. Le "normali"
si vedevano solo perché erano tutte dell'ultima settimana — passati otto giorni
sarebbero sparite anche quelle.

Il backend serviva già tutto: `getAutoscuolaAppointmentsFiltered` non ha limiti
di data e forza `studentId = utente` per gli allievi. **Nessuna modifica lato
server.**

## Animazioni
Reanimated, tempi dal design system:
- **indicatore del filtro** che scorre sotto la pillola attiva (spring
  damping 22 / stiffness 240, lo stesso degli sheet);
- **transizione della lista** in dissolvenza al cambio filtro (`key={tab}`);
- **entrata a cascata** delle card (`FadeInDown`, 28 ms per riga, **fermata a
  10 righe**: oltre, l'ultima card arriverebbe mezzo secondo dopo la prima e
  sembrerebbe lentezza, non ritmo);
- **feedback aptico** leggero al cambio filtro (`Haptics.selectionAsync`).

I quattro filtri stanno in **una riga non scorrevole**, pillole compatte che si
dividono lo spazio: una voce fuori schermo è una voce che nessuno trova.
- **Modalità autonoma** (`le-tue-guide.tsx`): risolve l'allievo collegato via `regloApi.getStudents()` + `findLinkedStudent` (match per email, poi per nome) e passa lo `studentId` alla vista condivisa.

## Badge
| Condizione | Badge |
|-----------|-------|
| `status === 'completed'` | **"Svolta"** (verde) |
| `status === 'no_show'` | **"Non presentato"** (rosso) |
| futura e programmata | **"In programma"** (blu) |
| `cancelledAt > penaltyCutoffAt` | **"Annullamento tardivo"** (ambra) |
| tardiva **e** `lateCancellationAction === 'charged'` | **"Addebitata €X"** (scuro, `penaltyAmount`) |
| tardiva **e** `lateCancellationAction === 'dismissed'` | **"Non addebitata"** (verde) |
| non tardiva | **"Annullata"** (grigio) |

## API / dati
- Nessun nuovo endpoint: riusa `useAppointments` / `getAppointments` con `status:'cancelled'` + `light:true`. I campi annullamento arrivano dal ramo **`light`** di `getAutoscuolaAppointmentsFiltered` lato backend (`cancelledAt/penaltyAmount/penaltyCutoffAt/lateCancellationAction`). Vedi `reglo/docs/features/appointments.md` e `penalties.md`.

## Connected features
- **Booking Flow** — le guide programmate sono le stesse dell'agenda allievo; card home tappabili aprono il dettaglio guida.
- **Backend (`reglo`)** — semantica cancellazioni: `manual_cancel` (annullamento allievo, con preavviso/penale), `record_cleanup` (pulizia storico owner, esclusa da questa vista).
- **Home allievo** — **non** toccata da REG-510: la Home resta com'era (finestra
  `oggi − 7 giorni`, nessuno storico). Lo storico vive qui.
