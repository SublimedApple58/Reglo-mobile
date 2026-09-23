# Esito esame (app istruttore)

L'istruttore che accompagna l'esame ne registra l'esito dal foglio esame:
**Idoneo** o **Respinto**. Parte mobile di REG-513 — la funzione nasce sul web
(agenda, dettaglio allievo, drawer consorzio) e qui si aggiunge il punto di
ingresso di chi l'esito lo conosce per primo.

## Dove

`app/(tabs)/home/exam-manage.tsx` — il foglio esame dell'istruttore, aperto
toccando un esame dalla home. Ogni allievo iscritto ha:

- la **pastiglia dell'esito** sulla riga (verde Idoneo, rosso Respinto), assente
  finché non è stato registrato — un esame futuro non è "in attesa di giudizio";
- la voce **"Registra esito"** nel menu •••, che apre Idoneo / Respinto e, se un
  esito c'è già, "Togli esito".

Il menu ••• ora si apre **anche con un solo iscritto**: prima usciva un avviso
e basta, perché l'unica azione era rimuovere. Un esame con un allievo solo è il
caso normale, ed è proprio lì che serve l'esito.

### Dettaglio allievo

`src/screens/StudentNotesDetailScreen.tsx` (rotte `home/student-detail` e
`notes/[studentId]`, entrambe solo staff) — nello storico, la riga di un esame
porta la **pastiglia dell'esito** accanto alla chip "Esame", con le stesse
tinte del registro web. Prima l'esame si vedeva ma l'esito no: la lista
riceveva già `examOutcome` dal ramo *full* di `/api/autoscuole/appointments`,
semplicemente non lo mostrava.

La pastiglia è **toccabile**: apre lo stesso menu del foglio esame, così
l'esame di ieri si chiude da dove si guarda l'allievo. Su un esame già
iniziato senza esito compare al suo posto **"Registra esito"** (contorno
violetto). Dopo il salvataggio la schermata si **ricarica dal BE** — la fase in
testa deve muoversi insieme all'esito, e niente update ottimistici.

Menu, etichette, tinte e regola di registrabilità stanno in
`src/utils/examOutcome.ts`, condiviso fra foglio esame e dettaglio allievo:
gemello di `reglo/lib/autoscuole/exam-outcome.ts`.

## Cosa NON fa

**Non chiede il numero di patente.** Arriva quasi sempre giorni dopo l'esame, e
lo inserisce dal web chi ha la tastiera davanti. Ometterlo non cancella quello
eventualmente già registrato: l'API distingue "campo assente" da "campo vuoto".

## API

`POST /api/autoscuole/appointments/<id>/exam-outcome` con `{ outcome }`.
La route delega a `setExamOutcome`, la **stessa action del web**: permessi
(OWNER ∨ INSTRUCTOR) e regole vivono lì, non nella route.

`regloApi.setExamOutcome(appointmentId, outcome)`. Il campo viaggia
sull'appuntamento come `examOutcome` ed è già nel bootstrap agenda, quindi la
home lo riceve senza chiamate aggiuntive.

## Conseguenza da conoscere

Un **idoneo** porta l'allievo a `PATENTATO` lato server. Da quel momento
**sparisce dal picker "Seleziona allievo"** della prenotazione, che mostra solo
la fase PRATICA (REG-499), e perde il flag "Pronto per l'esame". L'app lo dice
con un avviso *"X è ora patentato"* quando la promozione avviene davvero.
È reversibile dal web riportando la fase a PRATICA.

Documentazione web: `reglo/docs/features/exam-outcome.md`.
