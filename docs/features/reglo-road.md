# Reglo Road (REG-638) — mobile

Guida in diretta per l'istruttore: durante una guida singola in auto il telefono entra in
**modalità Road** (mappa a tutto schermo, GPS, percorso, segnalazioni sul punto esatto,
pagellino, «Termina guida», riepilogo). L'allievo, a guida finita, vede percorso e
segnalazioni nel dettaglio guida (se l'autoscuola lo consente).

Contratto API e regole di prodotto: `reglo/docs/features/reglo-road.md` (backend già fatto).
Anteprime approvate: `/tmp/hiro-anteprime/reg-638/` (mobile-1…7, allievo-1).

> **Build nativa obbligatoria** (niente OTA verso i 2.3.0): moduli nativi nuovi
> `expo-location`, `expo-task-manager`, `react-native-maps`, `expo-keep-awake` + config
> nativa → `version`/`runtimeVersion` **2.4.0**, `versionCode` 8. Vedi `docs/git-flow.md`.

## Interruttore
- `AutoscuolaSettings.roadEnabled` (sola lettura, acceso dal backoffice).
- `useRoadEnabled()` vale **solo `=== true`** (gli altri flag usano `!== false`: qui no).
- Road esiste solo per il ruolo **istruttore** (`INSTRUCTOR` / `INSTRUCTOR_OWNER`).

## File

| Cosa | Dove |
|---|---|
| Tipi Road | `src/types/regloApi.ts` (`RoadState`, `RoadSessionWithLesson`, `RoadDetail`, `RoadMarker`, `RoadPoint`, …) |
| Endpoint | `src/services/regloApi.ts` (`getRoadState`, `startRoadSession`, `getRoadSession`, `sendRoadPoints`, `addRoadMarker`, `removeRoadMarker`, `endRoadSession`, `getRoadForAppointment`) |
| Hook interruttore | `src/hooks/useRoadEnabled.ts` |
| Entry (task GPS definito prima dell'app) | `entry.ts` (`package.json` `main`) |
| Task GPS + start/stop | `src/road/tracking.ts` |
| Code persistenti (punti, segnalazioni) | `src/road/queue.ts` |
| Uploader (lotti, backoff, via) | `src/road/uploader.ts` |
| Stato live (mappa, km, toast, riepilogo) | `src/road/roadStore.ts` |
| Azioni (entra, riprendi, segnala, annulla, termina, esci) + permesso | `src/road/roadActions.ts` |
| Regia (stato al foreground, invito, instradamento) | `src/road/RoadController.tsx` (montato in `app/_layout.tsx` AuthGate) |
| Ingresso (seed fogli, informativa) | `src/road/entryFlow.ts` |
| Pagellino da Road | `src/road/pagellino.ts` → `app/road/pagellino.tsx` = `manage-lesson-details` variante `road` |
| Simboli 3D segnalazioni | `src/road/markerArt.ts`, `assets/road/*.png` |
| Formattazione (km con virgola, HH:MM) | `src/road/format.ts` |
| Pezzi di mappa | `src/components/road/RoadMapParts.tsx` (percorso, pin, auto), `RoadMiniMap.tsx` (`RoadRouteMap`), `RoadMarkerList.tsx` |
| Modalità Road (stack a sé, niente tab) | `app/road/_layout.tsx`, `index.tsx` (mappa), `segnala.tsx`, `riepilogo.tsx`, `pagellino.tsx`, `select-options(-long).tsx` |
| Invito / informativa | `app/(tabs)/home/road-invite.tsx`, `road-privacy.tsx` (TALL_SHEET) |
| «Entra in Road» nella home | `WeeklyLiveCard` prop `onEnterRoad`, cablata in `IstruttoreHomeScreen` |
| Percorso allievo | `app/(tabs)/home/lesson-detail.tsx` (blocco «Il tuo percorso»), `app/(tabs)/home/road-map.tsx` (tutto schermo), `src/road/routeMapStore.ts` |

## Flusso istruttore
1. **Invito**: `RoadController` legge `/road/state` all'avvio e a ogni ritorno in primo piano.
   Se c'è `eligibleLesson` (finestra da 15 min prima, guida singola in auto), nessuna sessione
   e l'invito non è silenziato → form sheet «Entri in modalità Road?». «Non ora» silenzia
   l'invito **per quella guida** (AsyncStorage `reglo.road.dismissedInvites.v1`); la X lo
   chiude soltanto (torna al prossimo foreground). La stessa guida ha anche il bottone nero
   «Entra in Road» nella card «In corso» della home.
   «Partenza da …» compare solo se il seed porta un luogo (oggi `/road/state` non lo dà).
2. **Primo ingresso** (una volta per dispositivo, `reglo.road.privacySeen.v1`): «Prima di
   partire» → «Continua» → permesso **«Mentre usi l'app»** (mai «Sempre»). Negato → Alert con
   «Apri Impostazioni», niente Road.
3. **Entra**: `POST /road/sessions` (la guida diventa `checked_in`), coda agganciata alla
   sessione (`seq` riparte da `lastSeq + 1`), GPS acceso, `router.replace('/road')`.
4. **Road**: tutta l'app è lo stack `app/road` (l'AuthGate lascia stare il gruppo `road`;
   `RoadController` instrada lì finché `phase !== 'idle'`). Schermo sempre acceso
   (`useKeepAwake`). Camera che segue l'auto (heading, pitch 40°, auto un po' sotto metà
   schermo via `mapPadding`); se l'utente trascina la mappa smette di seguire, «ricentra» la
   riaggancia. Rotazione mappa disattivata: la camera la governa l'app, l'auto ruota di
   `heading − headingCamera`.
5. **Segnala**: tocco = segnalazione subito sul punto attuale (ultima posizione del task, o
   `getLastKnownPosition`), haptic medium + success, il foglio si chiude, toast «… segnato ·
   via · HH:MM» con «Annulla» per 5 s. Pressione lunga = nota (`Alert.prompt` su iOS, campo
   nel foglio su Android).
6. **Pagellino**: page sheet sopra Road (`manage-lesson-details` con `road`): titolo
   «Pagellino», chip «Resti in Road: il percorso continua», CTA **nera**, niente
   tipo/esito/note; salva solo `evaluations`. Il tracking non si ferma.
7. **Termina**: haptic warning → Alert nativo → svuota le code, spegne il GPS, svuota di nuovo,
   `POST /end` (guida `completed`) → riepilogo. Se `end` fallisce (offline) il GPS si
   riaccende e l'Alert dice di riprovare.
8. **Riepilogo** (page sheet, niente swipe): numeri, percorso e segnalazioni **dal server**.
   Card pagellino gialla: «Compila» (vuoto) / «Completa» (N voci su M) / «Apri» (completo);
   nascosta se il pagellino è spento. «Chiudi» → `exitRoad()` → la home.

## Tracking e code offline
- Task `reglo-road-location` (`expo-task-manager`) definito in `entry.ts`, quindi registrato
  prima che l'app monti: riceve le posizioni anche in background / schermo spento.
- `startLocationUpdatesAsync`: `BestForNavigation`, `AutomotiveNavigation`,
  `distanceInterval: 8`, `pausesUpdatesAutomatically: false`,
  `showsBackgroundLocationIndicator: true` (pillola blu), Android foreground service
  «Guida in corso / Reglo Road registra il percorso» colore `#111111`.
- Punto = `[tMs, lat, lng, speedMs|null, heading|null, accuracyM|null]`, accodato su file
  (`documentDirectory/reglo-road-queue.json`).
- Uploader: ogni ~10 s o a ≥ 40 punti. Il lotto si **congela** (`inflight`, `seq`
  persistito) finché il server non lo conferma: si rimanda identico, `duplicate: true` = ok.
  Backoff 2 s → 60 s, ripartenza immediata al ritorno online (NetInfo).
  `accepted:false` / `SESSION_CLOSED` → GPS spento, coda scartata, Alert «Guida chiusa».
- Segnalazioni: coda separata con `clientId` generato in app (idempotente); «Annulla» prima
  dell'invio toglie l'add dalla coda, dopo manda `DELETE …/markers/<clientId>`. Restano in
  coda anche dopo la fine (il server le accetta fino a 2 h dopo la chiusura). Un rifiuto 400
  (guida chiusa da troppo, tipo sconosciuto) le scarta.
- Via: `reverseGeocodeAsync` dell'ultimo punto al massimo ogni ~20 s, campo `street`.
- **Ripresa dopo kill**: all'avvio `/road/state.activeSession` → `resumeRoad()` → rientra
  in Road, ricarica percorso e segnalazioni dal server, riaccende il GPS se era fermo.
- Km durante la guida = stima locale (stessi filtri del server: accuratezza > 50 m e salti
  > 180 km/h scartati). I numeri del riepilogo sono quelli del server.

## Allievo
`lesson-detail.tsx`: solo per guide `completed` chiama `GET /road/appointments/:id`; se torna
un dettaglio (il server applica setting `studentNotesEnabled` e permessi) mostra «Il tuo
percorso» fra orario e righe istruttore/veicolo: minimappa non interattiva con chip vetro
«Mappa», «6,3 km · 54 min», elenco segnalazioni. Tocco → `road-map` a tutto schermo.

## Permessi e config nativa (`app.json`)
- Plugin `expo-location` con testi italiani, `isIosBackgroundLocationEnabled: true`,
  `isAndroidForegroundServiceEnabled: true`, `isAndroidBackgroundLocationEnabled: false`.
- iOS `UIBackgroundModes: ["location"]`, `NSLocationWhenInUseUsageDescription`.
- Android `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_LOCATION`.
- **Google Maps Android**: chiave da `GOOGLE_MAPS_ANDROID_API_KEY` (EAS secret / env) letta
  da `app.config.js` (unico pezzo dinamico, il resto sta in `app.json`). Senza chiave la mappa
  Android resta grigia.

## Gotcha
- **Task GPS ripristinato da iOS dopo un kill**: `EXTaskService` riregistra da solo
  `reglo-road-location` al lancio. Se nel frattempo la sessione è stata chiusa/cancellata
  altrove, `RoadController` lo spegne (`/road/state` senza `activeSession` + task attivo), e
  l'uploader scollega la coda alla prima risposta `NOT_FOUND`/`SESSION_CLOSED`.
- Alert «Terminare la guida?»: niente `isPreferred` (su iOS 26 colora di blu il bottone; in
  Road niente blu). Il nativo non può fare il bottone nero dell'anteprima: restano due bottoni
  neutri.
- Toast: animazione esplicita (shared value), non `entering` di Reanimated: lo schermo è ancora
  coperto dal form sheet che si chiude e l'animazione di ingresso non partiva.
- La posizione di una segnalazione non aspetta mai il GPS: ultimo fix fino a 5 min (auto ferma
  = nessun punto nuovo), poi last-known, poi lettura fresca con timeout 5 s.
- Scritta «Legal» di Apple: `legalLabelInsets` la mette fra pannello e cerchio velocità.
- Edifici 3D (`showsBuildings`) con pitch 40°: in curva possono coprire tratti del percorso
  (gli overlay di react-native-maps stanno sotto gli edifici).
- **Mai** `useReducedMotion` / `reducedMotion`: le animazioni restano sempre.
- In Road nessun navy: CTA nere `#111111` (anche il «Salva» del pagellino in variante road).
- Immagini 3D delle segnalazioni: niente `tintColor`.
- `Marker` custom: su iOS (Apple Maps) l'ancora si fa con `centerOffset`, su Android con
  `anchor`; su Android `tracksViewChanges` resta acceso solo ~1 s (poi la view è rasterizzata).
- `Marker.rotation` su iOS vale solo con Google Maps: l'auto si ruota con un `transform`.
- `manage-lesson-details` è registrato in tre stack (home, notes, road): il picker «Aggiungi
  voce» va spinto sullo stack corrente (`segments[0] === 'road'`).
- Il foglio «Cosa è successo?» non ha ScrollView (fitToContents su iOS); su Android
  TALL_SHEET + `SheetScaffold`.
- App Store / Play: la posizione in background va dichiarata (uso: registrare il percorso
  della guida in corso, avviato dall'utente, indicatore visibile). Su Play Console serve la
  dichiarazione del foreground service di tipo `location`.

## Colore delle auto e ingresso (2026-10-27)

- **Colore auto**: `RoadLesson.carColor` (dal backend, già risolto veicolo → tinta istruttore → bianco). Varianti pre-generate in `assets/road/cars/auto-{su,34}-<chiave>.png`; `carTopArt(color)` / `car34Art(color)` in `src/road/markerArt.ts` (chiave sconosciuta → bianco). Usate da `RoadCarMarker` (mappa Road) e dall'invito `road-invite`. Solo immagini JS: arriva via OTA.
- **Ingresso in Road**: `RoadController` rilegge `/road/state` all'avvio, al ritorno in primo piano, ogni 60 s con l'app aperta e subito dopo «Presente» (`requestRoadCheck({ force: true })` da `executeStatusAction`, ripropone l'invito anche se chiuso con «Non ora»). Il bottone nero «Entra in Road» sta sulla guida idonea sia nella live card della vista settimanale sia nella riga dell'itinerario giornaliero (`testID itin-enter-road`). OTA iOS runtime 2.4.0 del 27/10 (gruppo 9211f025).

## QA 27/10 sera — segno, pagellino, percorso nella guida, fogli

- **Segno**: `RoadMarker.sentiment`; in «Segnala» l'interruttore «Fatto bene / Da migliorare» (`roadStore.sentimentMode`, resta per la sessione, default «da migliorare»). `src/components/road/RoadSentiment.tsx` (`SentimentBadge`, `SentimentCounts`, `countSentiments`); bordo colorato su `RoadMarkerPin`, badge in `RoadMarkerList` e nel toast; conteggi in riepilogo, vista allievo, percorso.
- **Pagellino** (`manage-lesson-details`, condiviso home/note/Road): tutte le voci subito con le stelline, le non toccate restano «non valutate»; niente più «Aggiungi voci» né ×.
- **Percorso nella guida (istruttore)**: `RoadLessonCard` nel dettaglio guida (`manage-lesson`), `RoadHistoryChip` nello storico di `StudentNotesDetailScreen` (`getRoadForStudent`). Entrambi aprono `road-percorso` (home + notes), form sheet che abbraccia il contenuto; dalla mappa si va a `road-map`.
- **Fogli**: riepilogo e pagellino da Road sono form sheet `fitToContents` (`TALL_SHEET`); il pagellino usa `SheetScaffold hugScroll` (abbraccia il contenuto, scorre solo se supera lo schermo, «Salva» sempre visibile).

## Road libero — tab «Road» e «Avvia guida» (piano A, 28/10)

- **Tab «Road»** (`app/(tabs)/drive/`, route `drive` perché `/road` è la modalità Road): visibile agli istruttori sempre quando Road è acceso (`GET /road/state` → `roadEnabled` → `roadStore.roadEnabled`, letto da `RoadController`); nessuna impostazione a parte (decisione di Tiziano, 28/10). Mappa con la posizione (solo se il permesso c'è già), auto 3D nel colore dell'auto proposta, pannello «Pronto a partire?» con guide oggi / prossima / auto libere. Bottone: «Avvia guida» → foglio; «Entra in Road» se c'è la guida di adesso; «Torna in Road» se Road è in corso.
- **Foglio «Avvia guida»** (`drive/avvia.tsx`, TALL_SHEET, radice = ScrollView del foglio §13.2.1): allievi recenti a chip + «Altro…» (picker `select-student` riesportato nello stack), auto (filtrate per patente con `vehicleServesStudent`, le occupate spente), durata (durate dell'istruttore). «Parti con …» → `enterRoadFree` (`roadActions.ts`): permesso posizione, `POST /road/free`, conferme «Procedi comunque» per limite settimanale e pausa, `CURRENT_LESSON` → alert «Entra in Road» su quella. Primo ingresso sul dispositivo: l'avvio passa da `roadPendingStart` all'informativa `drive/road-privacy` (stesso foglio della home).
- Opzioni lette dalla tab e passate al foglio con `src/road/freeStartStore.ts`.
