# REG-409 follow-up — Luogo per tipo di patente (mobile + prenotazione allievo)

> **Cosa è stato fatto** (2026-09-19, branch `tizianodifelice1/reg-409-luogo-prenotazione-allievo`
> su **entrambi** i repo)
>
> Chiusi i due follow-up lasciati aperti da REG-409 (web-only):
>
> 1. **Mobile, creazione guida da staff** — `BookingForm` (istruttore/titolare)
>    precompila il campo "Luogo" con la stessa precedenza del web:
>    **default dell'allievo (REG-392) → luogo assegnato alla patente della guida
>    → sede**.
> 2. **Prenotazione dell'allievo dall'app** — non finisce più *sempre* in sede:
>    applica la stessa precedenza. La correzione è **backend**, non mobile (vedi
>    sotto).

## Scoperta di scope: il punto 2 è backend, non mobile

Il brief ipotizzava `src/screens/AllievoHomeScreen.tsx` o il flow di
prenotazione collegato. **Non è lì**: la prenotazione self-service dell'allievo
non ha affatto un campo Luogo lato app — `locationId` non compare in
`AllievoHomeScreen`. È il **backend** che assegna il luogo alla creazione
dell'appuntamento, con una query hardcoded sulla sede, in due punti di
`reglo/lib/actions/autoscuole-availability.actions.ts`:

| Funzione | Percorso | Commento originale |
|---|---|---|
| `createBookingRequest` | prenotazione normale dall'app (`bookingSource: studentSelf`) | `// Default location: link student-initiated bookings to the company sede` |
| `respondWaitlistOffer` | accettazione di un'offerta lista d'attesa (`bookingSource: slotFill`) | idem |

Entrambe facevano `findFirst({ isDefault: true })` e scrivevano quell'id.
È esattamente il punto che il piano REG-409 aveva annotato come
«Lasciate invariate di proposito — da decidere se allinearle».

## Modifiche

### `reglo/` (backend)

- `lib/autoscuole/locations.ts` — nuovo `resolveStudentBookingLocationId(tx, {companyId, studentId, vehicleLicenseCategory})`:
  carica luoghi attivi (`isDefault desc, name asc`, l'ordine che il resolver si
  aspetta) + `CompanyMember.defaultLocationId`/`licenseCategory` dell'allievo, e
  delega a `resolvePrefilledLocationId` — **lo stesso modulo puro del web**,
  nessuna logica duplicata.
- `lib/actions/autoscuole-availability.actions.ts` — i due `findFirst({isDefault:true})`
  sostituiti dalla chiamata all'helper. La categoria del veicolo arriva da
  `activeVehicles` (già in scope, ha `licenseCategory`) nel primo punto e da una
  lookup per id nel secondo.

### `reglo-mobile/`

- `src/utils/locationForLicense.ts` — **gemello** di
  `reglo/lib/autoscuole/location-for-license.ts` (stessa shape di
  `GET /api/autoscuole/locations`, stesse regole). Come `mandatoryLessons.ts` e
  `agendaColors.ts`: le due copie vanno cambiate insieme.
- `src/types/regloApi.ts` — `AutoscuolaLocation.licenseCategories?: string[] | null`
  (opzionale: sui backend pre-REG-409 il campo non c'è → lista vuota).
- `src/components/booking/BookingForm.tsx` — effetto di ricalcolo del Luogo:
  - cambio **allievo** → ricalcola sempre e azzera la scelta manuale;
  - cambio **veicolo** → ricalcola solo se il Luogo non è stato scelto a mano;
  - scelta manuale dal picker → alza `locationTouchedRef`, il veicolo non lo
    tocca più.
  - Con la lista luoghi non ancora in cache l'effetto non fa nulla: resta il
    valore seedato, quindi REG-392 continua a funzionare come prima (il blocco
    imperativo in `openStudentPicker` è rimasto apposta come risposta immediata).

## Decisioni

| Domanda | Scelta |
|---|---|
| Duplicare il resolver sul mobile o esporlo via API | **Duplicare** (gemello puro), come le altre regole condivise del repo. Nessun endpoint nuovo |
| Precedenza sulla prenotazione allievo | **La stessa del web**: allievo → patente → sede |
| Il veicolo nella prenotazione allievo | Quello **assegnato dal matcher**; se assente (o modulo Veicoli spento) si ricade sul percorso dell'allievo |
| `licenseCategories` opzionale nel tipo mobile | Sì — backward-compatible con backend più vecchi |

## Verifiche fatte

- `npx tsc --noEmit` pulito su `reglo/`.
- `npx tsc --noEmit` su `reglo-mobile/`: resta **solo** l'errore preesistente di
  `src/navigation/TabNavigator.tsx` (file legacy/non montato), verificato
  presente anche su `master` senza le mie modifiche.
- 14 unit test di `tests/unit/autoscuole/location-for-license.test.ts` verdi
  (il resolver condiviso non è stato toccato).
- Nessuna migrazione: il campo `licenseCategories` esiste già da REG-409.

## Fuori scope

- **Cambio automatico**: "B" copre manuale e automatica (invariato da REG-409).
- **Guide di gruppo**: `createGroupLesson` non è stata toccata.
