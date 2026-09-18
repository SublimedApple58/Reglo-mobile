# REG-409 follow-up — Luogo nelle guide di gruppo (mobile)

> **Cosa è stato fatto** (2026-09-19, branch `tizianodifelice1/reg-409-luogo-guide-di-gruppo`)
>
> `CreateGroupLessonScreen` non aveva alcun campo Luogo: le guide di gruppo
> create da app nascevano senza luogo. Ora c'è una riga **Luogo**, precompilata
> col criterio del web e modificabile a mano.

## Dipendenza da un altro branch

Questo branch **merge-a dentro di sé** `tizianodifelice1/reg-409-luogo-prenotazione-allievo`,
perché `src/utils/locationForLicense.ts` (il modulo gemello) nasce lì e non
esiste su `master`. Conseguenza: **non può andare in prod prima di quello**, si
porta dietro i suoi commit. Nessun commit è stato fatto sul branch di partenza,
che resta chiuso.

## Criterio: allineato al web, non inventato

Il backend (`createGroupLesson` su staging) accetta `locationId` opzionale e, se
il client lo omette, risolve da sé con `resolveGroupLessonLocationId` →
`resolveGroupPrefilledLocationId`. Ho **portato quel resolver** nel gemello
mobile invece di scrivere un criterio mio, così i due lati non possono divergere.

**Precedenza** — come la guida singola, ma ogni passo richiede **unanimità**,
perché gli allievi (e sul moto i veicoli) sono più d'uno:

| Passo | Regola |
|---|---|
| 1 | `defaultLocationId` degli allievi **pre-inseriti**, se chi ce l'ha concorda. Chi non ce l'ha non esprime preferenza e non blocca gli altri |
| 2 | Luogo della patente, se i veicoli della guida portano **allo stesso luogo** — unanimità sul *luogo risolto*, non sulla categoria: A1 e A2 assegnate allo stesso luogo vanno bene |
| 3 | Sede |

Le categorie arrivano dal **veicolo condiviso** (`kind:"standard"`) o
dall'**intera flotta** (`kind:"moto"`). L'**auto al seguito è esclusa apposta**:
è un accessorio di categoria B e manderebbe ogni gruppo moto al luogo della B.

### Criterio provvisorio scartato

Prima che il backend fosse su staging avevo scritto un `groupLessonLicenseCategory`
provvisorio, marcato come tale. Divergeva su due punti e **è stato rimosso** una
volta letto il criterio vero:

- saltava del tutto il passo 1 (default degli allievi), assumendo che «un gruppo
  non ha l'allievo» — il web invece li usa, in unanimità;
- sul moto chiedeva unanimità sulla **categoria** invece che sul **luogo
  risolto**, quindi una flotta A1+A2 mappata sullo stesso luogo sarebbe finita
  in sede per eccesso di prudenza.

## Modifiche

- `src/utils/locationForLicense.ts` — aggiunti `unanimous`,
  `ResolveGroupLocationInput`, `resolveGroupPrefilledLocationId`. Corpi delle
  funzioni verificati **identici** a quelli web con un diff meccanico (unica
  differenza: l'ordine di dichiarazione del type).
- `src/types/regloApi.ts` — `CreateGroupLessonInput.locationId?: Uuid | null`.
- `src/screens/CreateGroupLessonScreen.tsx` — stato `locationId` +
  `locationTouchedRef`, effetto di precompilazione, `openLocationPicker` (riusa
  il route `home/manage-lesson-location`, già generico e store-driven), riga
  Luogo in fondo al gruppo campi, `locationId` nel payload di `createGroupLesson`.

## Verifiche fatte

- `npx tsc --noEmit`: resta **solo** l'errore preesistente di
  `src/navigation/TabNavigator.tsx` (file legacy/non montato), presente anche su
  `master` senza queste modifiche.
- Diff meccanico gemello web ↔ mobile del resolver di gruppo: logica identica.
- Nome del campo backend verificato su `origin/staging`: `locationId`.

## Da fare

- **QA su staging** — non ancora eseguito. Da provare: standard con veicolo la
  cui categoria è assegnata a un luogo; moto con flotta omogenea; moto con
  flotta mista mappata sullo stesso luogo (deve dare quel luogo, non la sede);
  allievi pre-inseriti con default concordi e discordi; scelta manuale che
  resiste al cambio veicolo/flotta.
- **Modale di gestione** (`home/manage-group-lesson`): non espone il Luogo, si
  può solo scegliere in creazione. Fuori scope qui.
