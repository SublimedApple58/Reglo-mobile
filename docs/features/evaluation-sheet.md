# Pagellino di valutazione (REG-443) — lato istruttore

L'autoscuola configura le voci del proprio pagellino dal web (Impostazioni → Pagellino);
l'app le mostra **dentro il foglio "Dettagli guida"**, sotto la valutazione complessiva.
Nessuna schermata nuova: l'istruttore apre il foglio, tocca le stelline che vuole
correggere e usa il "Salva" sticky già presente.

## File

| Cosa | Dove |
|---|---|
| Sezione Pagellino | `app/(tabs)/home/manage-lesson-details.tsx` |
| Stelline (N a scelta) | `src/components/StarRating.tsx` (prop `total`, default 5) |
| Trattino "non valutabile" | `app/(tabs)/home/manage-lesson-details.tsx` (stato `notApplicable`) |
| Punteggio di partenza + dimensione stelline | `src/utils/evaluationSheet.ts` |
| Tipi + chiamata | `src/types/regloApi.ts` (`EvaluationItem`, `AppointmentEvaluation`), `src/services/regloApi.ts` (`getAppointmentEvaluation`) |
| Salvataggio | `ManageLessonDetailsPayload.evaluations` → `IstruttoreHomeScreen.saveLessonDetails` e `StudentNotesDetailScreen` |

## Comportamento

- Il foglio carica pagellino e punteggi in **una sola chiamata** all'apertura
  (`GET /api/autoscuole/appointments/:id/evaluation`).
- Se l'autoscuola non ha il pagellino attivo (o la chiamata fallisce) la sezione **non
  compare** e il foglio resta identico a prima: tipo, stelle complessive, note.
- Il pagellino si compila **in qualsiasi momento**: a guida programmata, a metà guida (dopo
  "Presente") o a guida conclusa. Non segue il gate della valutazione complessiva, che il server
  accetta solo su guide già effettuate; resta nascosto solo sulle guide annullate che non hanno
  punteggi.
- Le stelline partono da **metà scala** (3 su 5, 2 su 3) e valgono come punteggio anche
  se l'istruttore non le tocca: una guida valutata ha sempre il pagellino completo.
- Ritoccare la stellina già selezionata **non azzera** la voce (il pagellino non ha lo
  stato "non valutato", a differenza della valutazione complessiva).
- Le stelline sono **navy** come quelle della valutazione complessiva: il design system
  mobile è mono-navy, vedi `docs/design-system.md`.
- Scale possibili: 3 o 5 stelline (30px e 26px rispettivamente).

## Consultazione dallo storico guide

Nello storico guide di un allievo (`StudentNotesDetailScreen`) la riga mostra una chip
`★ Pagellino 4,2/5`; toccando la guida si apre il foglio "Dettagli guida" con tutte le voci —
in **sola lettura** quando la guida non è più modificabile (`hasSavedScores` tiene visibile la
sezione anche fuori dalla finestra di valutazione).

La media si calcola solo se le voci condividono la scala; con scale miste la chip mostra il
conteggio (`evaluationSummary` in `src/utils/evaluationSheet.ts`, gemello di quello web).

I punteggi arrivano già nel payload di `getAppointments` (ramo non-`light`), quindi la chip non
costa una chiamata per riga.

## Stelline gialle: eccezione voluta al mono-navy

Le stelline del pagellino sono **gialle (#FACC15)** anche su mobile, per essere identiche al web.
È una deroga esplicita al design system mono-navy, decisa da Tiziano per questa feature. Per
coerenza dentro le stesse schermate sono gialle anche le stelline della **valutazione
complessiva** nel foglio "Dettagli guida" e nella riga dello storico guide. `StarRating` ha per
questo una prop `tone` (`'navy'` di default, `'gold'` dove serve il giallo) — non usarla altrove
senza una decisione di prodotto. Restano navy tutti gli altri usi, compreso lo storico dell'app
ALLIEVO (`StudentMyNotesScreen`), che il pagellino non lo vede.

## La stellina singola non si compila più (2026-09-10)

La sezione "Valutazione" è stata tolta dal foglio "Dettagli guida": al suo posto c'è il pagellino.
Il payload `ManageLessonDetailsPayload.rating` è diventato opzionale e non viene più inviato.

Dove la stellina resta:
- **storico guide lato scuola**: solo sulle guide **senza** punteggi pagellino (le vecchie), dove
  è l'unica valutazione esistente; su quelle col pagellino c'è la sola chip;
- **app allievo** (`StudentMyNotesScreen`): invariata, mostra la stellina se c'è. Sulle guide nuove
  non ci sarà: l'allievo il pagellino non lo vede (v1 interna) — conseguenza accettata;
- **"voto medio"** nella scheda allievo: invariato per ora, resta la media delle stelline storiche.

Il sottotitolo della card "Dettagli guida" ora riassume il pagellino (`pagellino 4,2`) invece della
stellina (`4★`); il placeholder è "Tipo, pagellino e note".

## Voce "non valutabile" (trattino nella scala)

Non tutte le guide toccano tutti i punti. Ogni riga ha un **trattino `[—]` dentro la scala**,
subito prima delle stelline: un tap esclude la voce da QUELLA guida, un altro la rimette. Attivo =
bordo e testo navy; la riga mostra "non valutabile" al posto di "3/5" e le stelline restano vuote.

- Scelta di Tiziano contro swipe sulla riga e long-press: quelle a riposo non comunicano nulla,
  il trattino sì (ed è raggiungibile da VoiceOver, che uno swipe custom non sarebbe).
- Il tap-target è 38×34 con `hitSlop`, `accessibilityRole="button"` e
  `accessibilityState={{ selected }}`.
- In **sola lettura** (storico, guida non più modificabile) il trattino non compare: resta
  l'etichetta "non valutabile" sopra le stelline vuote.
- Nel payload la voce esclusa viaggia come `{ itemId, score: null, notApplicable: true }`: la riga
  si salva comunque, altrimenti sarebbe indistinguibile da una voce aggiunta al pagellino dopo.
- Togliendo l'esclusione torna il **voto di prima** (lo stato `notApplicable` è separato da
  `scores`).
- Si possono escludere tutte le voci: la chip dello storico diventa "Pagellino non applicabile"
  (`evaluationSummaryLabel` in `src/utils/evaluationSheet.ts` — gemello del web: le tre etichette
  della chip stanno lì, non nei componenti).

## Il foglio scrolla (regola per i FormSheet)

Con più voci il contenuto supera l'altezza che un `fitToContents` può abbracciare e il "Salva"
restava tagliato. La regola, valida per ogni form sheet dell'app: **è la sheet stessa a dover
scrollare**, non si avvolge il contenuto in una View/ScrollView interna aggiunta a mano.

- La route usa **`PAGE_SHEET`** (`presentation: 'modal'`). `TALL_SHEET` (`fitToContents`) taglia il
  contenuto, e nemmeno `SCROLL_SHEET` basta: **un formSheet a detent ha un pan nativo che ruba il
  gesto allo scroll interno**, quindi non si arriva mai in fondo — stesso muro già documentato in
  `notes/_layout.tsx` per REG-426 (booking-rules). PAGE_SHEET è il pattern delle form lunghe
  dell'app (quick-book, booking-rules).
- Il corpo usa `SheetScaffold` con `fill`: scroll interno del componente condiviso + footer
  agganciato in fondo.
- Coda del contenuto (`paddingBottom: 28`) e footer con `paddingBottom: max(insets.bottom, 12)`:
  senza, l'ultima voce del pagellino finisce sotto il "Salva" o a filo del bordo.
