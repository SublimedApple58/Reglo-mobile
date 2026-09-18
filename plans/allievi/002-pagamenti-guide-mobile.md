# REG-450 — Gestione pagamenti guide lato mobile (istruttori/titolari)

## Cosa è stato fatto

Replicato su mobile il registro guide filtrabile che il web ha nel dettaglio
allievo (tab "Guide"), con la possibilità di segnare una guida come pagata.
Visibile a **istruttori e titolari**, mai agli allievi.

- **Backend** (`reglo`, branch `tizianodifelice1/reg-450-pagamenti-mobile`):
  nuovo permesso scoped `canManageLessonPayments` (admin ∨ OWNER ∨ INSTRUCTOR)
  usato solo da `setManualPaymentStatus`, guardia "solo le tue guide" per
  l'istruttore, e nuova route `PATCH /api/autoscuole/appointments/[id]/manual-payment`.
  Nessuna migrazione: `manualPaymentStatus` esiste già sul modello.
- **Mobile**: blocco "Pagamenti" nel dettaglio allievo → schermata dedicata
  `StudentPaymentsScreen` con i filtri del web e il menu nativo per riga.

## Piano approvato

### Fase 1 — Backend (worktree dedicato)
- Helper scoped `canManageLessonPayments`: i **crediti** restano owner/admin
  (`canManageStudentCredits` invariato), si allarga solo il tracciamento del
  pagamento manuale.
- L'istruttore può segnare pagata **solo le proprie guide**
  (`appointment.instructorId === ownInstructor.id`), stessa guardia di
  `updateAutoscuolaAppointmentDetails`. **Differenza voluta**: lì una guida
  `cancelled` è non modificabile, qui resta segnabile — è il caso della penale
  tardiva "da pagare".
- Route `PATCH .../manual-payment` come wrapper sottile: permessi e rifiuto dei
  pagamenti automatici Stripe restano dentro l'azione condivisa col web.

### Fase 2 — Contratto mobile
- `AutoscuolaAppointment`: aggiunti `manualPaymentStatus`, `creditApplied`,
  `paymentRequired` — **già restituiti** dal ramo full di
  `/api/autoscuole/appointments` (`include` senza `select`), mancavano solo nei
  tipi. Nessuna modifica alla lettura backend.
- `AutoscuolaSettings.lessonCreditsRequired`: già nel payload di
  `/api/autoscuole/settings`, mancava nel tipo.
- `src/utils/lessonPayments.ts`: gemello di
  `reglo/lib/autoscuole/unpaid-auto-block.ts` (`isCompanyManualMode`,
  `isLessonUnpaid`) + i derivati UI (`isPenaltyCharged/Paid`,
  `canToggleLessonPayment`, `canActOnLessonPayment`).

### Fase 3 — UI
- Blocco "Pagamenti" in `StudentNotesDetailScreen` (riga sola: conteggio da
  pagare o check "tutto saldato"), visibile solo in modalità manuale.
- `StudentPaymentsScreen` su route `student-payments`, registrata in **entrambi**
  gli stack (`home` + `notes`) perché la scheda allievo si apre da tutti e due.
- Filtri identici al web: Tutte · Future · Da pagare · Completate · Annullate,
  con "Da pagare" presente solo in modalità manuale.

### Fase 4 — Docs + test locale
- `docs/features/lesson-payments.md`, `INDEX.md`, `impact-map.md` su entrambi i repo.
- Test su simulatore iOS contro backend locale (`localhost:3001`).

## Emendamenti durante l'implementazione

1. **Niente bottoni inline nella riga.** Il piano mostrava un bottone
   "Segna pagata" dentro ogni riga (come il web). Il design system mobile lo
   vieta esplicitamente ("Non mettere bottoni di azione inline dentro ogni riga
   di lista — usare un menu nativo aperto dalla riga"): il tap sulla riga apre un
   `ActionSheetIOS` / `Alert` con l'azione disponibile. Le righe senza azione non
   sono tappabili.
2. **Ordinamento per mese invece di "non pagate in cima".** Il web ordina le
   guide non pagate prima di tutte le altre. Su mobile le righe sono raggruppate
   per mese in ordine cronologico inverso: è l'ordine di lettura naturale di una
   lista lunga, e il segnale "quante da pagare" non si perde (hero in testa +
   contatore sulla pill del filtro). I **predicati** dei filtri restano identici
   al web — cambia solo la presentazione.
3. **Storico grezzo separato.** `StudentNotesDetailScreen` scartava le guide
   annullate subito dopo il fetch. Ora tiene anche la lista completa
   (`allAppointments`), che serve al registro pagamenti: "Annullate" è un filtro
   e le penali tardive sono guide da pagare. La lista usata dal resto della
   schermata è invariata.

## Note di rilascio

Il mobile **dipende dal deploy backend**: senza la route `manual-payment` in
produzione, "Segna pagata" risponde 404. Ordine: merge + deploy `reglo` →
poi OTA mobile.
