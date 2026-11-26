# «Oggi» e tab del titolare (REG-794, rilascio 2)

La schermata d'apertura del titolare e del titolare-istruttore: cosa succede
adesso a scuola, chi è al lavoro e com'è la giornata di ogni istruttore.
Anteprime approvate da Tiziano il 26/11: O1, O1b e O2 in
`/tmp/hiro-anteprime/reg-794/`.

## Tab

| Ruolo | Tab |
|---|---|
| Titolare puro (`OWNER`) | **Oggi · Agenda · Allievi · Tu** |
| Titolare-istruttore (`INSTRUCTOR_OWNER`) | **Oggi · Agenda · Road · Allievi · Tu** (Road solo con Road acceso) |
| Istruttore | invariato: Agenda · Road · Allievi · Tu |

- **Tolte per i titolari**:
  - la tab «Istruttore»: la sua parte utile è la sezione Istruttori di Oggi; `OwnerInstructorScreen` non è più raggiungibile;
  - la tab «Notifiche»: ora è la campanella in testa a Oggi;
  - la voce «Panoramica Istruttori» di Tu.
- **«Tu»** unisce «Altro» e «Impostazioni», come per l'istruttore.
- **Dopo l'avvio e il login** i titolari partono da Oggi: `homeRouteFor` in `src/utils/roles.ts`, usato da `app/index.tsx` e `app/_layout.tsx`, più `initialRouteName` delle tab.
- **Barra delle tab**: le radici dei titolari scorrono sotto il vetro come quelle dell'istruttore.
  - `UNDER_GLASS_TABS` comprende `today`.
  - `useTabBarOverlap` vale anche per i titolari. Senza, la barra del fantasma restava nascosta sotto la tab bar.

## File

| File | Ruolo |
|---|---|
| `app/(tabs)/_layout.tsx` | Tab `today` prima di tutte (solo titolari), `role` e `inbox` nascoste ai titolari, `more` = «Tu» |
| `src/components/AppTabBar.tsx` | `OWNER_ICONS` (= icone dell'istruttore + `today-outline`) |
| `app/(tabs)/today/_layout.tsx` | Stack di Oggi: `index`, `notifications`, `availability` (push); form sheet `instructor`, fogli della disponibilità (`availability-exception`, `publish-day`, `sick-leave`, `select-date*`, `time-picker`, `select-options*`), `out-of-availability`, fogli Road (`road-invite`, `road-privacy`, `giro`) |
| `src/screens/OwnerTodayScreen.tsx` | La schermata |
| `src/components/ownerToday/todayModel.ts` | Puro: `buildInstructorsToday` (giornata, stato a parole, chi lavora), `buildSchoolNow` (numeri della protagonista, prossime tre), `windowsText` |
| `app/(tabs)/today/instructor.tsx` | Foglio istruttore (O2), seed `ownerTodayInstructorStore` |
| `src/stores/ownerAgendaRequestStore.ts` | Oggi → Agenda: `mine`, `week`, `sick` |
| `src/components/agenda/AgendaTodayCard.tsx` | Riusata con `mine` + `onPress` per «Le tue guide: N» |

## Schermata

- **Testata**: `ClayLargeTitleScroll` con saluto (prop `greeting`), «Oggi», data e campanella (`InboxBellButton`, push in `today/notifications`).
- **Protagonista** «In guida adesso»: volante 3D e «N su M al lavoro».
  - N = istruttori in guida, in gruppo o all'esame adesso.
  - M = istruttori che oggi lavorano, cioè hanno impegni o disponibilità e non sono assenti.
  - Sotto la riga «Oggi X guide, Y già fatte · Giulia è all'esame» e «Tra poco» con le prossime tre.
  - A giornata finita: «Tutte fatte» con l'espresso. Senza guide: «Nessuna guida».
- **Livello 2, solo se servono**:
  - «Le tue guide: N» (solo titolare-istruttore, orologio 3D, mai il calendario «JUNE»), che porta ad Agenda «La mia»;
  - «N guide fuori disponibilità → Gestisci» di tutta la scuola, che apre `today/out-of-availability`.
- **Istruttori**: righe nell'ordine delle colonne dell'agenda (`orderInstructors`), con volto, nome («(tu)» per sé), stato a parole e numero di guide. Gli stati:
  - «In guida fino alle 11:00 · Federico Gallo»;
  - «All'esame fino alle…»;
  - «Guida di gruppo fino alle…»;
  - «Libero, la prossima alle…»;
  - «Giornata finita»;
  - «Disponibile, nessuna guida»;
  - «In malattia oggi» / «In ferie oggi»;
  - «Non lavora oggi».
- **Foglio istruttore** (O2):
  - «La sua giornata» a righe: le fatte in grigio, quella in corso in nero, «Assente» in rosso. Dopo cinque righe c'è «Altre N».
  - Chiama (`tel:`), se c'è il telefono.
  - Disponibilità, con le fasce di oggi, che apre «Disponibilità di X» (push in Oggi, dopo la chiusura del foglio; vedi [availability-editor.md](availability-editor.md)).
  - Assenze, con la prossima («Ferie dal 22 dic», `useInstructorAbsences(null)`), che apre la stessa schermata sulle Assenze. Per sé stessi resta «Segna malattia».
  - CTA «Vedi la settimana di Sara» («la tua» per sé).

## Dati

- **Bootstrap di oggi** di tutta la scuola: `useAgendaBootstrap` senza `instructorId`, da mezzanotte a mezzanotte. Contiene anche istruttori, telefono e blocchi.
- **Impostazioni**: `useAutoscuolaSettings`, per l'ordine delle colonne e le settimane di disponibilità.
- **Disponibilità**: `useSchoolAvailability`.
- **Guide fuori disponibilità**: query `['out-of-availability', company]`.
- **Aggiornamento**: tornando su Oggi si rinfresca in background se i dati hanno più di un minuto; c'è anche il trascina-per-aggiornare. L'ora corre ogni 30 secondi.
- **Al tocco**: nessuna chiamata.

## Oggi → Agenda

Malattia e settimana non si aprono nello stack di Oggi: il foglio malattia
apre altri fogli con percorsi fissi `home/...`. Oggi quindi:
1. chiude il suo foglio;
2. dopo 320 ms pubblica la richiesta in `ownerAgendaRequestStore` e passa alla tab Agenda.

`IstruttoreHomeScreen` esegue la richiesta una volta sola (`handledRequestRef`).
- **`week`**: la settimana dell'istruttore; la propria = «La mia».
- **`mine`**: «La mia», oggi.
- **`sick`**: la settimana dell'istruttore e, dopo 450 ms, il foglio malattia (`openSickLeaveFor`).

## Regole / gotcha

- **Due presentazioni dello stesso form sheet insieme si annullano.** Lo stack restava con un foglio invisibile e le aperture successive non si vedevano più. Per questo la richiesta si esegue una volta sola e c'è l'attesa tra chiusura e cambio di tab.
- **Malattia per un collega**: `sickLeaveSheetStore.forInstructorName` fa mandare `instructorId` a `instructor-sick-leave`.
  - Il backend accetta `instructorId` solo dai titolari, anche quando l'istruttore indica sé stesso, quindi va mandato solo per un collega.
  - Il foglio dice «Malattia di Marco», senza «Riguardati.».
- **Ferie**: dalle Assenze della disponibilità di un istruttore (REG-794).
- **Invito Road** (titolare-istruttore): si apre nello stack della tab in cui si è (`roadSheetBase`): in Oggi non salta più all'Agenda, e «Non ora» resta su Oggi.
