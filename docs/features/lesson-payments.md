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
| `src/screens/StudentPaymentsScreen.tsx` | La schermata: hero riepilogo, riga «Mostra», righe guida in card clay per mese, casella pagata |
| `src/components/PaymentHistorySheet.tsx` + `src/stores/paymentHistoryStore.ts` | Foglio «Guida»: stato, storico pagamento, CTA «Segna pagata / da pagare» |
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
cancellationKind !== 'record_cleanup' &&
!creditApplied && manualPaymentStatus !== 'paid' && (
   (status ∈ {completed, checked_in} && manualMode)
|| (status ∈ {cancelled, no_show} && lateCancellationAction === 'charged'
                                  && manualPaymentStatus === 'unpaid')
)
```

Cioè: **solo guide effettuate** non saldate, oppure **penali tardive addebitate**.
Mai le future programmate (anche se marcate `unpaid`), mai quelle coperte da credito,
mai quelle **rimosse dallo storico** dal titolare (`record_cleanup`, REG-634: anche
se conservano una penale addebitata). Gemello di `reglo/lib/autoscuole/lesson-unpaid.ts`.

## Filtri

Stessi identici predicati del web (`LessonFilter`):

| Filtro | Predicato |
|---|---|
| Tutte | — |
| Future | `status ∈ {scheduled, confirmed}` **e** `startsAt > now` |
| Da pagare | `isLessonUnpaid(l, manualMode)` — **presente solo in modalità manuale** |
| Completate | `status ∈ {completed, checked_in}` |
| Annullate | `status ∈ {cancelled, no_show}` |

Il filtro è **una riga «Mostra · Tutte · 55»** che apre il picker condiviso a
spunta (`optionsPickerStore`, come «Chi prenota»): niente tab a pillola che
escono dallo schermo (REG-639 giro pagamenti, 28/10). Ogni voce porta il
conteggio come sottotitolo. **Differenza voluta rispetto al web**: il web
ordina le non pagate in cima a tutto; qui le righe sono raggruppate per mese in
ordine cronologico inverso (ordine di lettura naturale su mobile). Il segnale
"quante da pagare" resta nell'hero in testa e nel contatore della voce.

## La riga (REG-639, giro pagamenti 28/10/2026)

Righe in **card clay** (`ClayList`), una card per mese con titolo di sezione
normale (`ClaySection`, mai MAIUSCOLETTO). Solo testo, bianco/nero: via glifi
tondi colorati, pallino «Pagata · data · persona» e chip «⏱ 2 ›».

| Zona | Contenuto |
|---|---|
| Titolo | `Mer 17 · 15:00` (grigio se annullata senza penale) |
| Sottotitolo | tipo guida (o "Guida di gruppo" / "Annullata tardi") · `Penale €X` se addebitata · istruttore |
| Destra | **UN solo segnale**: la casella se la guida si può segnare, altrimenti lo stato a parole |

**La casella** (guide con `canToggleLessonPayment` e `canManagePayments`):
vuota = da pagare, nera piena con la spunta = pagata. **Tocco = scrittura**
(spinner nella casella, poi toast e haptic di successo sulla risposta del BE);
si torna indietro toccandola di nuovo. Prima era un anello da tenere premuto
900 ms (REG-450): «cosa fa il cerchio» non era chiaro, ora è una casella come
in Promemoria. Sotto la lista una nota grigia lo dice.

**Stato a parole** (righe senza casella): `Da pagare` (nero 600: è quella che
conta), `A credito`, `Pagata`, `Annullata`/`Assente`, `Esame`, `Completata`,
`Programmata` (grigio).

**Tocco sulla riga** → foglio «Guida» (`payment-history`, `FORM_SHEET` in
entrambi gli stack): titolo data e ora, sottotitolo come la riga, «Stato»,
sezione «Storico pagamento» (eventi dal più recente, etichetta estesa + data ·
ora · persona) e, se la guida si può segnare, la CTA «Segna pagata / Segna da
pagare» (scrive, poi chiude il foglio).

VoiceOver: la casella è un `checkbox` con etichetta d'azione, la riga un
bottone che apre il dettaglio. Niente più menu di ripiego né suggerimento
«tieni premuto» (`HoldRing` non è più usato qui).

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

## Storico pagamento — chi e quando (REG-637)

Ogni guida della lista porta `paymentHistory` (dal più recente), che il BE manda
**solo allo staff** e solo sulla lista guide di un allievo
(`getAppointments({ studentId })`, ramo FULL). Eventi: `paid` / `unpaid` /
`cleared` (gesti manuali) e `credit_applied` / `credit_refunded` (dal ledger
crediti). Guide segnate prima di REG-637: storico vuoto → nessuna riga.

- **Non sta più sotto la riga** (REG-639 giro pagamenti): chi/quando e lo
  storico vivono nel foglio «Guida», aperto dal tocco su qualsiasi riga.
- **Foglio «Guida»**: rotta `payment-history` in ENTRAMBI gli stack (home +
  notes), `FORM_SHEET` + `<FormSheet>`. Seed via `paymentHistoryStore`
  (`lessonLabel`, `lessonSubtitle`, `stateLabel`, `events`, `action`),
  catturato al mount.
- Dopo «Segna pagata» il BE restituisce `paymentEvent`: si mette in testa allo
  storico locale (`patched`) senza rileggere.

Etichette, colori e `lastEventMatchesState` in `src/utils/paymentHistory.ts`:
copia gemella di `reglo/components/pages/Autoscuole/LessonPaymentTrail.tsx`,
cambiarle insieme.
