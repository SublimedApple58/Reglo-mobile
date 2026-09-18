# Pagamenti guide (REG-450) — lato istruttore/titolare

## What it does

Replica su mobile il registro guide filtrabile del **dettaglio allievo web**
(`AutoscuoleStudentsPage`, tab "Guide"): le guide raggruppate per stato con la
possibilità di segnarne una come **pagata** / **da pagare**.

Solo staff: istruttori e titolari. L'allievo non vede nulla di tutto questo —
la sua vista pagamenti è un'altra feature (`payments` tab, Stripe).

## Key files

| File | Ruolo |
|---|---|
| `src/screens/StudentPaymentsScreen.tsx` | La schermata: hero riepilogo, filtri, righe guida, menu azioni |
| `src/stores/studentPaymentsStore.ts` | Seed-and-callback (lezioni + settings + ruolo + `onChanged`) |
| `src/utils/lessonPayments.ts` | **Gemello** della regola backend (vedi sotto) |
| `app/(tabs)/home/student-payments.tsx` | Route stack home |
| `app/(tabs)/notes/student-payments.tsx` | Route stack notes (stessa schermata) |
| `src/screens/StudentNotesDetailScreen.tsx` | Blocco "Pagamenti" + `openPayments` + `allAppointments` |
| `src/services/regloApi.ts` | `setManualPaymentStatus(appointmentId, status)` |

## La regola "da pagare" — copia gemella del backend

`src/utils/lessonPayments.ts` è la copia riga-per-riga di
`reglo/lib/autoscuole/unpaid-auto-block.ts`. **Le due copie vanno cambiate
insieme**: la stessa definizione alimenta il badge del dettaglio allievo web, il
contatore della lista allievi e il **blocco automatico delle prenotazioni per
debito**. Se divergono, l'app conta guide diverse dal backend.

**Modalità manuale** (`isCompanyManualMode`) — l'autoscuola incassa a mano:

```
(!autoPaymentsEnabled && !lessonCreditFlowEnabled)
|| (lessonCreditFlowEnabled && !lessonCreditsRequired)
```

Fuori da questa modalità il concetto di "segna pagata" non esiste: il blocco
"Pagamenti" della scheda allievo **non compare** e la schermata è in sola
lettura (i soldi passano dalla sezione Pagamenti del web).
`lessonCreditsRequired` assente = `true` (default BE).

**Guida da pagare** (`isLessonUnpaid`):

```
!creditApplied && manualPaymentStatus !== 'paid' && (
   (status ∈ {completed, checked_in} && manualMode)
|| (status ∈ {cancelled, no_show} && lateCancellationAction === 'charged'
                                  && manualPaymentStatus === 'unpaid')
)
```

Cioè: **solo guide effettuate** non saldate, oppure **penali tardive addebitate**.
Mai le future programmate (anche se marcate `unpaid`), mai quelle coperte da credito.

## Filtri

Stessi identici predicati del web (`LessonFilter`):

| Filtro | Predicato |
|---|---|
| Tutte | — |
| Future | `status ∈ {scheduled, confirmed}` **e** `startsAt > now` |
| Da pagare | `isLessonUnpaid(l, manualMode)` — **presente solo in modalità manuale** |
| Completate | `status ∈ {completed, checked_in}` |
| Annullate | `status ∈ {cancelled, no_show}` |

Ogni pill porta il conteggio. **Differenza voluta rispetto al web**: il web
ordina le non pagate in cima a tutto; qui le righe sono raggruppate per mese in
ordine cronologico inverso (ordine di lettura naturale su mobile). Il segnale
"quante da pagare" resta nell'hero in testa e nel contatore della pill.

## Badge della riga

| Badge | Quando |
|---|---|
| Completata / Annullata / Assente / Programmata / Esame | stato della guida |
| **Da pagare** (ambra) | `isLessonUnpaid` |
| **Pagata** (verde) | `manualPaymentStatus === 'paid'`, non coperta da credito |
| **Coperta da credito** (viola) | `creditApplied` |
| **Tardiva · €X** (ambra) | penale addebitata non saldata (`penaltyAmount` se presente) |

## Azioni

La **pressione lunga È la conferma**: non apre più nessun foglio. L'anello a
destra si riempie mentre tieni premuto e al 100% l'azione parte; mollare prima
annulla e l'anello torna indietro. Niente action sheet che spunta di scatto.

### La riga (`LessonRow`)

Lista flat sullo sfondo, divisori rientrati sotto il glifo — vocabolario delle
liste iOS (Impostazioni / Wallet):

| Zona | Contenuto |
|---|---|
| Glifo tondo 36px | Lo **stato a colpo d'occhio**: € ambra da pagare · ✓ verde pagata · portafoglio viola a credito · ✕ grigia annullata · orologio grigia programmata · tocco viola esame |
| Titolo | `Mer 17 · 15:00` |
| Sottotitolo | tipo guida (o "Guida di gruppo" / "Annullata tardi") · istruttore |
| Valore a destra | `Da pagare` · `Pagata` · `A credito` · `€25` — in tinta col glifo |
| Anello 26px | Solo se azionabile. Verde per "segna pagata", **ambra** per il verso opposto |

Il glifo fa il lavoro che facevano tre badge in fila: la lista si legge
scorrendo la colonna di sinistra. Spariti con il redesign: colonna data, fila di
badge e i **tre puntini**, che dopo il passaggio alla pressione lunga non
facevano più niente.

### Gestualità

| Gesto | Cosa fa |
|---|---|
| Dito giù | `selectionAsync()`, la riga si accende (`#F7F8FA`) e l'anello parte |
| Tenuta 900 ms | Al cerchio chiuso: `notificationAsync(Success)` e scrittura |
| Rilascio prima | `cancelAnimation` + l'anello rientra di molla. Niente scrittura |
| Tocco breve | **Non** resta muto: l'anello fa un lampo e il suggerimento torna per 2,6 s |

**Scopribilità.** Tre livelli, nessuno invasivo:
1. L'**anello vuoto** è il segno permanente che su quella riga c'è qualcosa da tenere premuto — ha preso il posto dei puntini, e a differenza loro *fa* qualcosa.
2. Alla **prima apertura** una riga di suggerimento entra sotto i filtri ("Tieni premuta una guida finché il cerchio si chiude") e sparisce da sola dopo 5,2 s.
3. Il **tocco breve** la richiama, sempre.

Alla prima conferma completata si scrive `reg450.paymentsLongPressLearned` in
AsyncStorage e il suggerimento non parte più da solo.

**VoiceOver**: uno screen reader non sa tenere premuto. Con
`AccessibilityInfo.isScreenReaderEnabled()` attivo il doppio tocco apre il menu
nativo di ripiego (`ActionSheetIOS` / `Alert`), che resta in piedi solo per
questo.

### Anello (`src/components/HoldRing.tsx`)

Due semidischi che ruotano dentro due maschere, **niente SVG** — stessa tecnica
di `ProgressRing`, così viaggia via OTA senza toccare il binario. A differenza
di `ProgressRing`, che anima da sé un valore fisso al mount, `HoldRing` segue
uno `SharedValue`: il riempimento è il tempo di pressione.

### Filtri animati

La pastiglia navy **scivola** da un filtro all'altro (`withSpring` su
`translateX` + `width`, misurati con `onLayout`), le righe entrano e escono in
dissolvenza (`FadeIn`/`FadeOut` + `LinearTransition`), i contatori fanno
cross-fade cambiando `key`. Al primo montaggio la pastiglia si posiziona senza
scivolare (`ready`).

Nessun optimistic update (convenzione del repo): si scrive solo ciò che il BE ha
risposto (`res.manualPaymentStatus`), poi `onChanged` fa ricaricare la scheda
allievo sotto.

## API

| Chiamata | Note |
|---|---|
| `GET /api/autoscuole/appointments?studentId=…&limit=500` | **Ramo full** (niente `light`): è l'unico che restituisce `manualPaymentStatus`. Già usata dalla scheda allievo, nessuna chiamata nuova. |
| `GET /api/autoscuole/settings` | `autoPaymentsEnabled`, `lessonCreditFlowEnabled`, `lessonCreditsRequired`. Già caricata dalla scheda allievo. |
| `PATCH /api/autoscuole/appointments/:id/manual-payment` | **Nuova** (REG-450). Body `{ status: 'paid' \| 'unpaid' \| null }`. |

⚠️ La schermata **non fa fetch propri**: riceve tutto dal seed dello store. Chi
cambia `loadData` in `StudentNotesDetailScreen` deve continuare a passare
`allAppointments` (storico **grezzo**, annullate comprese) e `paymentSettings`.

## Connected features

- **Notes / dettaglio allievo** — il blocco "Pagamenti" vive in
  `StudentNotesDetailScreen`; la schermata si apre da entrambi gli stack.
- **Guide annullate** — le annullate con penale addebitata sono guide da pagare.
- **Backend (`reglo`)** — `docs/features/payments.md`, regola gemella in
  `lib/autoscuole/unpaid-auto-block.ts`.
