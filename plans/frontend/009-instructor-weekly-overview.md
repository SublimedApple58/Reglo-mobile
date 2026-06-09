# Vista settimana istruttore → "controllo in parole"

> **Stato: IMPLEMENTATO (2026-06-09)** su `feature/student-phase`.
> Preview approvata: `plans/frontend/008-weekly-control-preview.html`.
> (Iterazioni scartate: 005 agenda verticale, 006/007 timeline orizzontale + zoom — abbandonate perché diventavano "un ammasso di blocchetti".)

## Cosa è stato fatto

La vista settimana della home istruttore (`agendaViewMode === 'week'`) non è più una **griglia oraria** (`WeeklyAgendaView`, rimasta solo per la home Titolare) ma un'**agenda "controllo in parole"**: ogni giorno è una riga con una *striscia di densità* (solo il ritmo) + un **riepilogo testuale** che porta il significato (n° guide, esami, finestre libere a parole). **Tap su un giorno** → si espande in linea nell'itinerario completo (marker disponibilità + card lezioni + band `Libero` con long-press quick-book). Resta leggibile anche con la settimana piena, e il quick-book è preservato 1:1.

### Cornice allineata alla vista giorno (2026-06-09b)
Il week-mode header ora **rispecchia la chrome della vista giorno**: greeting piccolo (`greetRow`/`greetName` "Ciao, … 👋"), niente titolone + subtitle "Gestisci le tue guide", **rimosso il banner "Prossima"** (`featuredLesson`), aggiunto il banner "guide fuori disponibilità". Rimossa anche la barra di sintesi (guide · esami · ore) e la label "libero …" nelle righe (il ritmo libero/occupato resta nella striscia). L'unica parte che differisce dalla vista giorno è l'agenda stessa.

### Header su pannello tonale + swipe settimane (2026-06-09c)
- Header settimana rifatto su **pannello tonale** `#F4F5F9` con angoli alti arrotondati (come il calendar panel della vista giorno): titolo two-tone `8 – 13 Giugno` (range bold + mese muted), chip **Oggi** + icona **calendario** (apre `openAgendaCalendar`). **Frecce ‹ › rimosse.**
- **Navigazione settimane = swipe orizzontale nativo paginato** (`ScrollView horizontal pagingEnabled`, 3 pagine prev/current/next, recenter a metà su `onMomentumScrollEnd` → `setSelectedDate(±7)`). Altezza pagine vincolata via `onLayout` così la lista verticale interna scrolla.
- `weekAvailability` ora caricato per **3 settimane** (21 giorni) e **keyed per data** (`YYYY-MM-DD`) invece di colIdx 0–5 → lo swipe ha sempre la disponibilità delle settimane adiacenti (niente flash). *(Cambio contenuto solo in `IstruttoreHomeScreen`; il `WeeklyAgendaView` del Titolare usa ancora colIdx, intatto.)*

### Dettaglio giorno = page sheet nativo (2026-06-09e, SUPERA il punto sotto)
Gli approcci inline (accordion / focus-mode / maschera fatta a mano) creavano confusione e relayout brusco. **Soluzione finale: tap su un giorno → page sheet nativo** (`app/(tabs)/home/day-detail.tsx`, `presentation:'modal'`, X in alto a destra) con l'itinerario del giorno. Lo sfondo si oscura in modo **nativo**, il week resta overview sotto. `DayItinerary` estratto in `src/components/DayItinerary.tsx` (riusabile); seed via `src/stores/dayDetailStore.ts` (plan computato dallo screen + callback `openQuickBookSheet`/`openLessonDrawer`/esame/blocco). Le azioni dal sheet **chiudono prima il sheet** (`closeThen`, ~280ms) per non impilare sheet stantii. `WeeklyOverview` ora è solo overview (righe strip + parole, tap → `onOpenDay`); rimossi mask/focus/expand inline.

### ~~Modalità focus all'apertura di un giorno~~ (superato da page sheet)
Problema: l'accordion inline accumulava troppo (righe-overview con strisce + dettaglio aperto, tutto impilato → niente gerarchia). Soluzione **focus mode**: quando un giorno è aperto, (a) gli **altri giorni si ritirano** in righe compatte attenuate (`compactRow`, opacity 0.5: weekday+numero+conteggio, **niente striscia**); (b) il giorno aperto diventa **una card-hero unica** (`openCard`) con titolo "Mercoledì 10 · 1 guida" + chevron-up per chiudere + l'itinerario dentro (la striscia ridondante sul giorno aperto è rimossa). Riapri/chiudi col tap sull'header. Niente apertura quando non c'è nulla (giorni di riposo non espandibili).

### File
- **`src/utils/weeklyAgenda.ts`** (nuovo) — layer dati puro: `computeDayPlan(date, appointments, blocks, availabilitySlots, opts)` → finestre disponibilità/occupato, finestre libere (15′ grid), segmenti densità, conteggi; `lessonBadge`, formatter (`fmtClock`, `fmtFreeWindows`, `weekTotals`). Logica free-window replicata dall'itinerario giornaliero (nessun refactor del day view → zero regressioni).
- **`src/components/WeeklyOverview.tsx`** (nuovo) — header settimana (range + ‹ ›/Oggi) + sintesi + righe-giorno (striscia + parole) + espansione inline (`DayItinerary`) con `BookableBand`.
- **`src/screens/IstruttoreHomeScreen.tsx`** — `WeeklyAgendaView` sostituito da `WeeklyOverview` nel branch week; handler `openQuickBookSheet`/`openLessonDrawer`/exam/block ricablati; navigazione settimana via `setSelectedDate(±7)` (ricarica `weekAvailability`).

## Piano originale (4 fasi)
1. **Helper puri** (`weeklyAgenda.ts`) — computeDayPlan + formatter.
2. **WeeklyOverview** — header sintesi + righe (strip + parole) + tap-to-expand DayItinerary.
3. **Innesto** nella home (sostituzione WeeklyAgendaView, quick-book preservato).
4. **Rifinitura + docs**.

## Scelte / semplificazioni note
- Day view **non toccato**: la logica free-window è replicata nel helper (scelta di sicurezza vs refactor della IIFE inline ~330 righe).
- Zoom spaziale (preview 006/007) **non implementato**: il modello a parole rende lo zoom superfluo. Riattivabile come extra se richiesto.
- Esami **a orario** con più allievi: nel giorno espanso resi come righe separate (no grouping come nel day view) — accettabile per ora; gli esami "senza orario" restano i banner in cima.
- Domenica esclusa (Lun–Sab, 6 giorni), come la griglia precedente.
- `WeeklyAgendaView` **non rimosso**: ancora usato da `TitolareHomeScreen`.

## Da verificare su TestFlight
- Altezza/scroll della lista settimana + espansione (flex sotto l'header fisso).
- Long-press quick-book dentro il giorno espanso (ScrubBubble a livello schermo).
- `weekAvailability` popolato per tutti i giorni navigando ±settimane oltre la finestra `loadRange`.
