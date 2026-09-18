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

La **pressione lunga** (300 ms) sulla riga apre un **menu nativo**
(`ActionSheetIOS` su iOS, `Alert` su Android) con l'unica azione sensata:
"Segna pagata" oppure "Segna da pagare". Niente bottoni inline dentro la riga —
è una regola del design system. Le righe senza azione non sono premibili.

### Gestualità (`LessonRow`)

| Gesto | Cosa fa |
|---|---|
| Pressione lunga (300 ms) | `impactAsync(Medium)` + la riga si solleva (scale 1.02 → 1) e si apre il menu |
| Tocco breve | **Non** esegue e **non** resta muto: `selectionAsync()` + la riga cede (0.97 → 1) e il suggerimento ricompare per 2,6 s |
| Dito giù / su | scale 0.985 / 1, molla corta (`damping 20, stiffness 340`) |

**Scopribilità.** Tre livelli, nessuno invasivo:
1. Il `•••` in coda alla riga è il segno **permanente** che lì c'è un menu (colore `#B4B4BD`, un filo più presente del grigio disabilitato).
2. Alla **prima apertura in assoluto** una riga di suggerimento entra sotto i filtri ("Tieni premuta una guida per segnarla pagata") e sparisce da sola dopo 5,2 s. Nessun modale, niente "Ho capito" da premere.
3. Il **tocco breve** la richiama, sempre: chi tocca invece di tenere premuto riceve una risposta, non il silenzio.

Alla prima pressione lunga riuscita si scrive `reg450.paymentsLongPressLearned`
in AsyncStorage e il suggerimento non parte più da solo (resta la risposta al
tocco breve).

**VoiceOver**: uno screen reader non sa fare una pressione lunga. Con
`AccessibilityInfo.isScreenReaderEnabled()` attivo il doppio tocco apre
direttamente il menu, e la riga espone `accessibilityHint`.

> **Perché `ActionSheetIOS` e non il `ContextMenu` SwiftUI di `@expo/ui`.**
> Il menu contestuale vero (riga sollevata, sfondo sfocato) esiste in
> `@expo/ui/swift-ui`, già nel binario. È stato scartato per ora: è `0.2.0-beta`,
> richiede iOS ≥ 26 (su Android e iOS più vecchi servirebbe comunque il fallback,
> quindi due esperienze da mantenere) e imporrebbe un `Host` SwiftUI **per ogni
> riga** dentro una lista scrollabile — un rischio di performance e di crash che
> non è stato possibile misurare su dispositivo. Da rivalutare quando c'è modo di
> provarlo su un device vero: il punto di innesto è il solo `LessonRow`.

Una riga è azionabile se **entrambe**:
- `canToggleLessonPayment` — ricalca `showPaymentToggle` del web: con i crediti
  **obbligatori** non si segna nulla a mano; con i crediti facoltativi solo le
  guide effettuate; senza crediti anche quelle già `unpaid` (posti di guida di
  gruppo). Le penali tardive sono sempre segnabili. Una guida coperta da credito
  mai.
- `canManageLessonPayments(autoscuolaRole)` — l'utente è **staff** (titolare o
  istruttore). **Non dipende da chi ha tenuto la guida**: qualsiasi membro staff
  segna qualsiasi guida dell'allievo. Specchio di `canManageLessonPayments` in
  `reglo/lib/autoscuole/lesson-payments.ts`, dove sta il permesso vero.

> **Storico.** Fino al 18/09/2026 l'istruttore era ristretto alle proprie guide,
> per simmetria con `updateAutoscuolaAppointmentDetails`. La restrizione è stata
> rimossa di proposito: l'incasso non è un dato didattico della guida, è un
> fatto amministrativo dell'allievo, e chi incassa in autoscuola spesso non è
> l'istruttore che quella guida l'ha tenuta. Il test
> `tests/unit/autoscuole/lesson-payments.test.ts` lato backend esiste perché non
> rientri per distrazione.

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
