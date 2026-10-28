# REG-639 — fluidità (ombre, pressione, gesture, fogli, Road)

**Fatto (28/10/2026, branch `fix/reg-639-fluidita`, commit locali, niente push/OTA).**
Segnalazioni di Tiziano dal telefono: ombre tagliate, pressione rettangolare,
scatti (soprattutto Road), niente swipe indietro su Disponibilità/Notifiche,
fogli chiudibili solo con la X, dettaglio guida con Road che compare a scatti.

## Cosa è stato fatto
1. **Ombre** — cause alla radice (design-system §0.3): `overflow: 'hidden'` di un
   antenato (collassabile di Dettagli guida → margine compensato), testata
   fissa di `FormSheet` bianca sopra l'alone (ora trasparente a riposo),
   `shadow*` legacy (`ProgressRing`, marker mappa → `boxShadow`), banner esami
   dell'agenda con `overflow` sullo stesso nodo dell'ombra (→ figlio che ritaglia).
2. **Pressione** — `ClayList` passa `first`/`last`; `clayRowPressShape` +
   `CLAY_ROW_PRESSED` in `ClayListRow`, `ClayTextRow`, notifiche, giorni della
   pubblicazione (anche il ritaglio della riga swipe).
3. **Gesture indietro** — `home/availability`, `home/notifications`,
   `drive/notifications` come push; fogli della Disponibilità nello stack
   corrente (`useStackBase`). Le altre push (Tu, Allievi, scambi, inviti) erano
   già push native.
4. **Fogli** — `FORM_SHEET` senza `gestureEnabled: false`; `FormSheet` con
   `busy` / `dirty` (conferma nativa) / `closeOnGesture`; fogli alti: tirati giù
   oltre l'inizio si chiudono a rimbalzo finito. Pagellino/Dettagli guida =
   conferma se ci sono modifiche; riepilogo Road = esce da Road; «appena finita»
   si chiude normalmente.
5. **Dettaglio guida con Road** — React Query + prefetch al tocco del blocco,
   minimappa dopo la presentazione su segnaposto, dissolvenza.
6. **Scatti** — `useRoadSelector` (prima ogni fix GPS ridisegnava anche il
   layout delle tab), pin memoizzati, cache su file scritta a interazioni finite
   (~400 KB serializzati sul thread JS), tracciati Road fuori dalla cache.

## Emendamenti durante il lavoro
- Tiziano: TUTTI i fogli si chiudono con swipe e tocco fuori; per riepilogo /
  pagellino Road / «appena finita» niente blocco, ma conferma nativa se ci sono
  modifiche non salvate.
- Il primo fallback «tira giù per chiudere» chiudeva durante il rimbalzo e
  lasciava il velo scuro del foglio piantato: ora chiude a rimbalzo finito.

## Non verificabile da qui
- Swipe indietro dal bordo: Maestro non lo esegue nemmeno in Impostazioni di iOS.
- Evidenziazione al tocco: Maestro non tiene la pressione abbastanza per fotografarla.
