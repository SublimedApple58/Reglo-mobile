# REG-639 — giro Road (Tiziano 28/10/2026)

**Stato:** branch `feat/reg-639-giro-road` (da `origin/master`). Fatti e verificati
sul simulatore i due bug: (1) avatar del dettaglio allievo tagliato (`2574dfa`),
(5) foto/avatar mai a scatto + skeleton + cache (`16b82f9`). Punti 2, 3, 4: piano
in attesa dell'ok di Tiziano. Niente merge/OTA senza ok. Anteprime:
`/tmp/hiro-anteprime/giro-road/`.

Regole sempre valide: bianco/nero, clay leggero, niente pillole/badge/eyebrow,
niente toast nei fogli, fogli adattivi senza grabber, animazioni veloci
(200–300 ms) mai spente da Riduci movimento.

---

## Punto 2 — Note sulla guida dentro Road

**Account/piattaforma:** istruttore, app mobile iOS + Android, solo mobile (OTA).
**Fisso o configurabile:** fisso. Nessun interruttore per le note (il pagellino
invece dipende da `evaluationSheetEnabled` dell'autoscuola).

**Oggi**
- Le note sono un campo di testo libero **per guida**: `AutoscuolaAppointment.notes`.
- Si scrivono solo dalla matita nello storico del dettaglio allievo (foglio
  `manage-lesson-details`).
- Il backend (`PATCH /api/autoscuole/appointments/[id]`, `notes`) le accetta in
  qualunque momento. Le blocca solo su guide annullate o di altri istruttori.
  **Nessun cambio backend.**
- Road usa lo stesso foglio in variante `road` (pagellino) e nasconde le note di
  proposito (`notes: null`, salva solo `evaluations`).
- Le note le vede anche l'allievo (`StudentMyNotesScreen`).

**Piano**
1. Tasto «Note» nella testata di Road (`app/road/index.tsx`), accanto a
   «Pagellino».
   - Apre un foglio con il solo campo di testo, precompilato con la nota esistente.
   - Si riusa `edit-notes` + `notesEditorStore`, registrato nello stack
     `app/road/_layout.tsx` come `FORM_SHEET`.
   - Va bene la dettatura della tastiera iOS.
   - Salva solo su risposta del server (niente optimistic).
2. A fine guida, nel riepilogo (`app/road/riepilogo.tsx`) e nel foglio «Appena
   finita» (`app/(tabs)/drive/appena-finita.tsx`), una riga «Note sulla guida»
   sotto il pagellino, con l'anteprima del testo e «Scrivi»/«Modifica».
3. Nel foglio, una riga grigia: «La vede anche <nome>».
4. Le note esistenti si leggono dall'appuntamento, perché `RoadLesson` non ha
   `notes`.
5. Road libero (senza una guida in agenda): niente note, non c'è una guida a cui
   attaccarle.

**Raccomandazione:** farlo così. Tocca solo il mobile, riusa componenti già
esistenti e ha un rischio basso.

---

## Punto 3 — CTA «Avvia con Road» nel dettaglio della guida in corso

**Account/piattaforma:** istruttore, app mobile iOS + Android, solo mobile (OTA).
**Configurabile:** sì, segue il servizio Road dell'autoscuola (acceso dal
backoffice, `useRoadEnabled`).

**Oggi**
- L'invito «Entri in Road?» viene da `RoadController.check()` + `road-invite.tsx`.
- «Non ora» lo silenzia per quella guida (AsyncStorage
  `reglo.road.dismissedInvites.v1`).
- L'unico modo di tornarci è «Entra in Road» nella tab Road, poco visibile.
- Con una sessione Road attiva l'app intera è `/road`, quindi l'agenda non si vede.
  «Riprendi in Road» in pratica non serve: l'etichetta è sempre **«Avvia con
  Road»**.

**Piano**
1. Nel foglio della guida (`app/(tabs)/home/manage-lesson.tsx`, CTA in
   `LessonActions`), una CTA nera «Avvia con Road» con il glifo mappa/play, sopra
   Presente/Assente.
2. Compare solo se:
   - Road è acceso per l'autoscuola;
   - l'utente ha il ruolo istruttore;
   - `roadStore.eligible.appointmentId === lesson.id`, cioè la stessa guida che il
     server indica come avviabile adesso. Questo esclude esami e guide di gruppo,
     ed è lo stesso criterio dell'invito.
3. L'azione è `beginRoadEntry(router, eligible)`: privacy la prima volta, permesso
   di posizione, poi `/road`.
4. Sotto «Non ora» dell'invito, una riga grigia: «La ritrovi toccando la guida in
   agenda».

**Raccomandazione:** farlo così. È una sola CTA e riusa il flusso dell'invito.

---

## Punto 4 — Tab bar

**Oggi:** `AppTabBar` custom in JS (expo-router `Tabs`): bianca piena, una riga
sottile sopra, Ionicons piene/vuote. L'istruttore ha Agenda · Road · Allievi · Tu.

### Versioni (anteprime `40-tabbar-confronto.png`, `41/42/43-tabbar-A/B/C.png`)

- **A · Liquid Glass nativa**
  - È la tab bar vera di iOS 26 (`expo-router/unstable-native-tabs`,
    `react-native-screens` 4.16 già nel binario 2.4.0, quindi possibile via OTA,
    da verificare bene).
  - Flottante, in vetro, con icone SF Symbols. L'evidenza della tab attiva la
    disegna il sistema.
  - Su iOS precedenti diventa la tab bar classica nativa. Su Android sarebbe
    Material, quindi lì si tiene la B.
  - Da gestire:
    - il «+» dell'agenda va alzato sopra la barra;
    - Road a schermo intero deve restare senza barra;
    - i set di tab di titolare e allievo;
    - l'API è sperimentale.
- **B · Vetro a tutta larghezza**
  - È la barra di oggi in materiale traslucido (`expo-blur`, già nel binario), con
    il contenuto che scorre sfocato sotto.
  - Niente riga in alto, icone più grandi.
  - Rischio minimo, OTA sicuro.
- **C · Isola bianca**
  - Flottante, bianca piena con un'ombra morbida e il contenuto che sfuma sotto.
  - È nostra e non nativa, quindi la meno «Apple».

**Raccomandazione:** A su iOS e B su Android. Se non si vuole rischiare l'API
sperimentale, B ovunque.

### Tab Road che compare di botto

**Causa:**
- `useInstructorTabs` legge `roadStore.roadEnabled`, che parte da `false` e solo in
  memoria.
- Lo imposta `RoadController` dopo `GET /road/state`, chiamato 700 ms dopo
  l'avvio.
- Intanto `roadEnabled` è già salvato sul telefono nella cache persistita delle
  impostazioni dell'autoscuola (`useAutoscuolaSettings`, persister react-query,
  24 h), ma viene ignorato.

**Soluzione (le due cose insieme):**
1. La tab bar parte dall'ultimo stato noto: `roadStore` viene inizializzato dalla
   cache persistita delle impostazioni (o da una chiave dedicata in AsyncStorage).
   Chi ha già aperto l'app vede la tab giusta dal primo frame. `/road/state`
   corregge solo se lo stato è cambiato.
2. Prima apertura senza cache: la schermata di caricamento che c'è già
   (`LoadingScreen` in `AuthGate`) resta finché le impostazioni non sono note, con
   un limite di circa 1,5 s.
3. Se lo stato cambia a app aperta, le tab si ridistribuiscono con
   un'animazione di circa 220 ms, mai a scatto.
4. Da verificare che `settings.roadEnabled` e `/road/state.roadEnabled` coincidano
   sempre (stesso servizio dell'autoscuola).

**Raccomandazione:** 1 + 2 + 3. È solo mobile, OTA.

---

## Fatto in questo giro (bug, diretti)

- **(1) Avatar tagliato.** Il volto del dettaglio allievo aveva `marginTop: -8` e
  usciva dal bordo alto dello scroll del `FormSheet`, che lo ritagliava. Tolto il
  margine e compensato con la testata più bassa (`headerStyle paddingBottom 6`).
- **(5) Foto mai a scatto.**
  - `FadeImage`: skeleton e dissolvenza di 200 ms.
  - `UserPhotoCircle`: skeleton finché non si sa, poi foto o iniziali.
  - Cache della mappa id→URL in AsyncStorage (`userPhotos`).
  - File su disco (`photoDiskCache`, `expo-file-system`, perché expo-image non è
    nel binario).
  - Skeleton nella tab Road e sulla riga «Prossima guida».
  - Proposta aperta (backend, serve ok): ridimensionare le foto al caricamento
    (oggi PNG originali da circa 2,3 MB) e aggiungere `Cache-Control`.
