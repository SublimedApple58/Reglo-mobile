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

Il tap sulla riga apre un **menu nativo** (`ActionSheetIOS` su iOS, `Alert` su
Android) con l'unica azione sensata: "Segna pagata" oppure "Segna da pagare".
Niente bottoni inline dentro la riga — è una regola del design system. Le righe
senza azione disponibile non sono tappabili.

Una riga è azionabile se **entrambe**:
- `canToggleLessonPayment` — ricalca `showPaymentToggle` del web: con i crediti
  **obbligatori** non si segna nulla a mano; con i crediti facoltativi solo le
  guide effettuate; senza crediti anche quelle già `unpaid` (posti di guida di
  gruppo). Le penali tardive sono sempre segnabili. Una guida coperta da credito
  mai.
- `canActOnLessonPayment` — **l'istruttore agisce solo sulle proprie guide**
  (`instructorId === session.instructorId`), il titolare su tutte. È lo specchio
  della guardia backend: senza questo il pulsante comparirebbe per poi fallire.

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
