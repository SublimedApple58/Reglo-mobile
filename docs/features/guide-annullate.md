# Guide annullate (vista allievo)

## Cosa fa
Vista "Le tue guide" lato **allievo** con due segmenti: **Programmate | Annullate**. Il segmento Annullate mostra le guide che l'allievo ha annullato di persona, raggruppate per mese, con badge sullo stato della penale (tardiva / addebitata / non addebitata).

## File chiave
- `src/components/LessonsOverview.tsx` — componente condiviso (segmentato + liste + badge). Prop: `studentId`, `seededUpcoming?`, `onOpenDetail?`.
- `app/(tabs)/home/all-lessons.tsx` — accesso dalla **home** (sheet, `TALL_SHEET`): legge `allLessonsStore` (seed + callback), card programmate **tappabili** → `onOpenDetail`.
- `app/(tabs)/settings/le-tue-guide.tsx` — accesso **durevole** dal Profilo allievo (tab Impostazioni): modalità **autonoma**, card programmate **non** tappabili. Registrato in `app/(tabs)/settings/_layout.tsx` (`TALL_SHEET`).
- `src/screens/SettingsScreen.tsx` — voce **"Le tue guide"** nel `renderStudentContent` (gruppo preferenze, sopra Disponibilità), route `settings/le-tue-guide`. L'allievo non vede `MoreScreen`/"Altro".
- `src/stores/allLessonsStore.ts` — store seed-and-callback della home; ora porta anche `studentId` (serve al segmento Annullate per il fetch storico).
- `src/types/regloApi.ts` — `AutoscuolaAppointment` esteso con `cancelledAt`, `penaltyAmount`, `penaltyCutoffAt`, `lateCancellationAction`.

## Comportamento
- **Programmate**: in home arrivano seedate (`seededUpcoming`); in modalità autonoma (`le-tue-guide`) il componente le carica da sé via `useAppointments` (finestra +84 giorni, `light`, status `scheduled/confirmed/checked_in/pending_review`, futuro).
- **Annullate**: fetch **lazy** (solo quando il segmento è attivo) via `useAppointments` con `status:'cancelled'`, `from` a −12 mesi, `light`, `limit:200`. Filtrate a **`cancellationKind === 'manual_cancel'`** → escludono le rimozioni amministrative (`record_cleanup`) e organizzative della scuola. Raggruppate per mese (più recenti in alto).
- **Modalità autonoma** (`le-tue-guide.tsx`): risolve l'allievo collegato via `regloApi.getStudents()` + `findLinkedStudent` (match per email, poi per nome) e passa lo `studentId` alla vista condivisa.

## Badge (segmento Annullate)
| Condizione | Badge |
|-----------|-------|
| `cancelledAt > penaltyCutoffAt` | **"Annullamento tardivo"** (ambra) |
| tardiva **e** `lateCancellationAction === 'charged'` | **"Addebitata €X"** (scuro, `penaltyAmount`) |
| tardiva **e** `lateCancellationAction === 'dismissed'` | **"Non addebitata"** (verde) |
| non tardiva | **"Annullata"** (grigio) |

## API / dati
- Nessun nuovo endpoint: riusa `useAppointments` / `getAppointments` con `status:'cancelled'` + `light:true`. I campi annullamento arrivano dal ramo **`light`** di `getAutoscuolaAppointmentsFiltered` lato backend (`cancelledAt/penaltyAmount/penaltyCutoffAt/lateCancellationAction`). Vedi `reglo/docs/features/appointments.md` e `penalties.md`.

## Connected features
- **Booking Flow** — le guide programmate sono le stesse dell'agenda allievo; card home tappabili aprono il dettaglio guida.
- **Backend (`reglo`)** — semantica cancellazioni: `manual_cancel` (annullamento allievo, con preavviso/penale), `record_cleanup` (pulizia storico owner, esclusa da questa vista).
