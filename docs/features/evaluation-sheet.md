# Pagellino di valutazione (REG-443) — lato istruttore

Le voci del pagellino si configurano **dal web** (Impostazioni → Pagellino) **e dall'app**
(Altro → Pagellino, vedi in fondo); l'app le mostra **dentro il foglio "Dettagli guida"**,
sotto la valutazione complessiva.
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
- Se l'autoscuola non ha **nessuna voce** configurata (o la chiamata fallisce) la sezione **non
  compare** e il foglio resta identico a prima: tipo, stelle complessive, note.
- Se il pagellino è **spento** ma questa guida ha già dei voti, le righe votate **restano
  visibili e rimovibili**: spegnere significa "non se ne danno di nuovi", non "sparisce quello
  che c'è" (allineato al dialog web il 2026-09-12 — prima l'app nascondeva anche i voti già
  dati). L'elenco si riduce alle voci già votate, quindi "Aggiungi voce" sparisce da solo, e
  salvando non si cancella nulla: il payload `evaluations` parte solo se il pagellino è cambiato.
- Il pagellino si compila **in qualsiasi momento**: a guida programmata, a metà guida (dopo
  "Presente") o a guida conclusa. Non segue il gate della valutazione complessiva, che il server
  accetta solo su guide già effettuate; resta nascosto solo sulle guide annullate che non hanno
  punteggi.
- **Il pagellino si costruisce** (dal 2026-09-11, stesso modello del web): non c'è nessun
  elenco completo in attesa di stelline. L'istruttore aggiunge le voci che quella guida ha
  toccato e quelle sono il pagellino; le altre non esistono.
- In testa alla sezione il contatore "3 voci" — non c'è un totale da raggiungere.
- Ritoccare la stellina già scelta svuota il voto; per togliere la voce c'è la ×.
- Le stelline sono **navy** come quelle della valutazione complessiva: il design system
  mobile è mono-navy, vedi `docs/design-system.md`.
- Scale possibili: 3 o 5 stelline (30px e 26px rispettivamente).

## Scheda allievo: media per voce + pagellino della singola guida

Nella scheda allievo (`StudentNotesDetailScreen`), fra "obbligo guide" e lo storico, c'è il
blocco **PAGELLINO**: media generale, una riga per voce (barra oro + media + "su N guide") e la
**voce più bassa**. Stesso linguaggio a blocchi piatti del resto della schermata.

- Calcolo in `aggregateStudentEvaluations` (`src/utils/evaluationSheet.ts`). Gemello del web con
  UNA differenza: l'app non conosce l'elenco delle voci configurate dall'autoscuola, quindi
  l'ordine viene dalla **prima guida in cui la voce compare** (le guide arrivano dalla più
  recente) e manca il conteggio delle "voci mai valutate". Se servirà la parità esatta, la strada
  è un endpoint `GET /api/autoscuole/evaluation-sheet`.
- Fuori dal calcolo: guide annullate, voci "non valutabili", voci senza voto.
- **Zero chiamate nuove**: i punteggi arrivano già col payload dello storico.
- La statistica **"voto medio"** della card profilo è ora la media del pagellino; le vecchie
  stelline singole restano come ripiego per gli allievi storici (senza, su un allievo nuovo
  quel numero resterebbe vuoto per sempre).

Nella timeline la chip `★ Pagellino 4,5/5` **si apre**: mostra le voci della singola guida in
sola lettura (compreso "— non valutabile" sulle righe vecchie), una guida alla volta, con la
transizione di molla condivisa. Il foglio "Dettagli guida" resta il posto dove si **modifica**.

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

## Voce "non valutabile" (non si crea più)

Il trattino `[—]` è stato rimosso col modello "aggiungi voce": dire "questa qui no" ora
significa non aggiungerla. Le righe **già salvate** col flag restano: si leggono come
"non valutabile" e si possono solo togliere, così un salvataggio non le cancella di nascosto.
- In **sola lettura** (storico, guida non più modificabile) non compaiono né × né bottone
  "Aggiungi": restano le voci con i loro voti.
- Nel payload la voce esclusa viaggia come `{ itemId, score: null, notApplicable: true }`: la riga
  si salva comunque, altrimenti sarebbe indistinguibile da una voce aggiunta al pagellino dopo.
- Togliendo l'esclusione torna il **voto di prima** (lo stato `notApplicable` è separato da
  `scores`).
- Si possono escludere tutte le voci: la chip dello storico diventa "Pagellino non applicabile"
  (`evaluationSummaryLabel` in `src/utils/evaluationSheet.ts` — gemello del web: le tre etichette
  della chip stanno lì, non nei componenti).

## "Aggiungi voce": picker nativo riusabile

Il bottone tratteggiato apre **`OptionsPickerSheet`** (`optionsPickerStore.set()` +
`router.push('/(tabs)/<stack>/select-options')`), lo stesso form sheet nativo di Durata,
Veicolo, Tipo guida e Luogo — niente componente nuovo. Elenca solo le voci **non ancora in
elenco** e sparisce quando sono tutte aggiunte.

- **Selezione multipla** (a differenza del web, dove il menu è a un clic di distanza): sul
  telefono aprire uno sheet per ogni voce sarebbe un'animazione ogni volta.
- La route va spinta sullo **stack da cui si è arrivati** (`home` o `notes`, da `useSegments`):
  è registrata in entrambi.
- Sopra le 7 voci il picker passa da solo al page sheet scrollabile
  (`LONG_PICKER_THRESHOLD`), quindi anche il tetto di 40 voci è coperto.
- La **×** sulla riga sta in alto, lontana dalle stelline: togliere una voce non deve essere
  un errore di mira.
- **Aspetto (set. 2026)**: il picker usa righe-superficie con la selezione che tinge tutta la
  riga, e la CTA porta dentro il contatore ("2 · Aggiungi al pagellino"). Misure e regola della
  safe area in `docs/design-system.md` §13.2.1 — il restyle vale per TUTTI i picker
  (Durata, Veicolo, Tipo guida, Luogo), non solo per il pagellino.
- Nella lista, ogni voce è una **card** (raggio 20) e il punteggio è una **pillola oro**
  (`#FEF9C3` / testo `#A16207`, scala gialla del tema) accanto al nome: il voto è il dato della
  riga, non una didascalia. Le voci senza voto portano una pillola neutra "da valutare".

Le azioni di massa ("valuta tutte a metà scala", "segna non valutabili le restanti", "azzera")
sono state tolte insieme al modello vecchio: rimettevano in circolo i giudizi fabbricati.

## Attenzione: l'array vuoto è un segnale

Il foglio manda `evaluations` **solo se il pagellino è cambiato** (confronto con la firma di
quello caricato). Se l'istruttore toglie tutte le voci il payload è un **array vuoto**, che
significa "svuota il pagellino": `IstruttoreHomeScreen` e `StudentNotesDetailScreen` lo
inoltrano guardando `!== undefined`, non `.length` — con il controllo sulla lunghezza la
rimozione dell'ultima voce si perdeva in silenzio.

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


## Configurare le voci dall'app (Altro → Pagellino)

Dal 2026-09-12 la configurazione non è più solo web. Sta in **Altro → Gestione → Pagellino**,
accanto a Veicoli e Luoghi guida: è un'impostazione **di autoscuola**, non del singolo allievo,
quindi non va nel foglio "Impostazioni allievo".

**Chi la vede**: titolari **e istruttori** (`isOwner || isInstructor`). Il permesso vero è lato
server in `saveEvaluationSheet` (reglo), aperto agli istruttori nella stessa passata: sono loro
a compilare il pagellino tutti i giorni. Il gate nella route è solo cortesia.

| Cosa | Dove |
|---|---|
| Schermata | `src/screens/EvaluationSheetScreen.tsx` |
| Route + gate di ruolo | `app/(tabs)/more/evaluation-sheet.tsx` |
| Foglio "voce" (nome, scala, elimina) | `src/components/EvaluationItemSheet.tsx` + `app/(tabs)/more/evaluation-item.tsx` (HUG_SHEET) |
| Seed del foglio | `src/stores/evaluationItemStore.ts` |
| Lettura/scrittura | `regloApi.getEvaluationSheet` / `saveEvaluationSheet` → `GET`/`PUT /api/autoscuole/evaluation-sheet` |
| Cache | `useEvaluationSheet` (`STALE_TIMES.evaluationSheet`, 15 min) |
| Costanti (scale, max 40 voci, 60 caratteri, modello base) | `src/utils/evaluationSheet.ts` — gemelle del web |
| Riga nel menu | `src/screens/MoreScreen.tsx` |

### Come funziona

- **Draft + un solo Salva**, come sul web: la CTA "Salva pagellino" entra in scena solo quando
  c'è davvero qualcosa da salvare e il salvataggio è una **sostituzione integrale** dell'elenco.
  Niente salvataggio a ogni tocco: la regola no-optimistic renderebbe il riordino a scatti
  (ogni scambio aspetterebbe il server) e l'API sostituisce comunque tutto.
- Uscire con modifiche pendenti chiede conferma via `usePreventRemove`, che copre **anche lo
  swipe-back** iOS, non solo la freccia.
- **Riordino in drag&drop** scritto a mano con Reanimated + gesture-handler (nessuna dipendenza
  nuova: `react-native-draggable-flatlist` non è allineato a Reanimated 4 e non deve finire in un
  OTA). Le righe sono assolute su un passo fisso `STEP = 74 + 10`; una mappa `{key: indice}` in
  shared value è la verità, ogni riga la insegue con una molla. Il pan vive **solo sulla maniglia**
  e spegne lo scroll in `onBegin` (non `onStart`): così la ScrollView non ruba mai il gesto.
  Aptica `Medium` alla presa, `Light` a ogni scambio.
- L'altezza della card è **fissa** (74): il nome sta su una riga sola, per esteso si legge e si
  modifica nel foglio. Serve al riordino, che lavora su un passo costante.
- **Stato vuoto**: chi non ha mai configurato niente trova il **modello base** (le 5 voci del web,
  stessa costante) con "Usa il modello base" / "Parti da zero", non una lista vuota.
- Le voci tolte **si archiviano**, non si cancellano: il testo della conferma lo dice
  esplicitamente ("le valutazioni già date restano leggibili nello storico").
- Tetto di 40 voci (era 12 fino al 2026-09-18): oltre, il bottone "Aggiungi voce" lascia il posto alla riga che lo dice.

### Perché il foglio "voce" e non l'editing in riga

Sul web il nome si scrive in un input dentro la riga. Su mobile un campo di testo dentro una card
trascinabile è una rissa fra tastiera e gesto: nome, scala ed eliminazione stanno in un **form
sheet nativo** (`HUG_SHEET`, misure §13.2.1 del design system). La scala è un segmented a due
carte che mostra **le stelline vere**, non le parole "3 stelline". L'eliminazione è un bottoncino
rosso **in testa**: sotto la CTA occupava una fascia che si leggeva come padding vuoto.
