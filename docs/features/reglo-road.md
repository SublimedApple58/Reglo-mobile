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
- **Foglio «Avvia guida»** (`drive/avvia.tsx`, TALL_SHEET, radice = ScrollView del foglio §13.2.1), in due passi (29/10, dopo il feedback di Tiziano: le chip non reggono decine di allievi): (1) «Con chi guidi?» con ricerca attaccata in cima (`stickyHeaderIndices`), «Le tue ultime guide», poi tutti gli allievi in ordine alfabetico con lettere, righe con patente e ore di guida (`getStudentsCompletedHours`); (2) riepilogo: allievo con «Cambia», lista auto con auto 3D nel colore e radio (preselezionata, le occupate spente, filtrate per patente), durata, «Parti con …» → `enterRoadFree` (`roadActions.ts`): permesso posizione, `POST /road/free`, conferme «Procedi comunque» per limite settimanale e pausa, `CURRENT_LESSON` → alert «Entra in Road» su quella. Primo ingresso sul dispositivo: l'avvio passa da `roadPendingStart` all'informativa `drive/road-privacy`.
- **Tab bar** (`GlassTabBar`): vetro di sistema (`BlurView systemChromeMaterialLight`), icona piena sulla tab attiva, nero/grigio; sulla tab Road è sovrapposta alla mappa (`TAB_BAR_CONTENT_H`). Icona Road ovunque = `assets/road/road-3d.png` (segnaposto rosso su strada, la stessa del web).
- Opzioni lette dalla tab e passate al foglio con `src/road/freeStartStore.ts`.

### 29/10 — Avvia guida e tab bar (decisioni di Tiziano)
- Riepilogo: una sola riga «Auto» con l'auto preselezionata (la tua libera → prima libera adatta); riga secondaria «La tua auto · targa» (niente pillole/badge). Tocco → scelta con ricerca a sezioni native «La tua» / «Altre auto» / «Occupate adesso» («in guida con …», da `busyWith`).
- Tab bar istruttore con Road acceso (`useInstructorRoadTabs`): Home · Disponibilità · **Road al centro in rilievo** (cerchio nero con l'icona Road) · Allievi · Altro. «Notifiche» esce dalla barra: campanella con contatore (`InboxBellButton`) nel saluto della home e in alto a destra nella tab Road. Senza Road resta la barra di prima.
- Pannello «Pronto a partire?»: bianco e sobrio (Tiziano ha bocciato pesca, auto Fluent ed eyebrow). Niente pillola «Road» sulla mappa: solo la campanella. Tasto centrale: glifo bianco `navigate` (Ionicons) nel cerchio nero.

### 28/10 sera — tab bar «T1 piatta»
Sostituisce la scelta B (Road al centro in rilievo, rimossa con il suo codice). Barra bianca piatta, Agenda · Road · Allievi · Tu per l'istruttore; la tab Road non è più sovrapposta alla mappa. Dettagli in `design-system.md` §6.19.

## Tab Road «mappa corta» (27/10, variante 2)

- `app/(tabs)/drive/index.tsx`: mappa bassa (36% dello schermo, non interattiva) con auto e pin «Sede» (solo se il server manda `headquarters`), pannello bianco a due stati: guida in agenda tra poco (briefing + «Entra in Road» + «Parti con un altro allievo»), libero («Con chi guidi?», 3 volti suggeriti + «Tutti», briefing del volto scelto, «Parti con X · N min»). Sotto, «Ultime guide» → `road-percorso` registrato anche nello stack `drive`.
- Guida appena finita col pagellino da compilare (`toClose` del server): NIENTE CTA nella tab (Tiziano 28/10: una sola primaria, «Parti con»). Sulla tab si apre da solo il form sheet `app/(tabs)/drive/appena-finita.tsx` («Appena finita · orari», allievo, km/durata/segnalazioni, «Compila il pagellino» + «Più tardi»), UNA volta per guida e per avvio dell'app (`src/road/pagellinoPrompt.ts`, solo memoria, non persistito). Dopo, in «Ultime guide» la riga di quella guida dice «… · Pagellino da compilare» in grigio e il tap apre il pagellino.
- `src/components/road/RoadTabParts.tsx`: `BriefingLines` (tab), `BriefingRows` (foglio), `RoadAvatar`, `RouteThumb` (mappa vera senza gesti: tracciato se il percorso supera ~50 m, altrimenti zona del punto di partenza o della sede con un puntino; mai riquadro vuoto). Glifi monocromatici, niente pillole.
- `app/(tabs)/drive/avvia.tsx`: con un volto scelto si apre su «Parti con» (`roadFreePreselect`): allievo con riga del server, briefing, «Guida» con l'auto e «Cambia», durate, «Fino alle … · alle … hai …» (rosso se si sovrappone), «Parti con X». Intestazioni di sezione in frase normale (niente maiuscoletto).
- «Annulla» 10 s: `roadFreeStarted` (memoria) → banner nero in `app/road/index.tsx` → `undoRoadFree()` → `POST /road/free/undo`, GPS spento, si torna alle tab. Il riepilogo aggiunge «In agenda diventa …; prezzo e crediti restano quelli dei N minuti scelti».

## Clay v2 (REG-639, 28/10/2026)

Tutte le schermate Road usano il design system clay v2 (design-system §0):
tab Road (pannello bianco, briefing in card con l'icona 3D di ogni voce e il
glifo del segno in fondo, sede = punto nero sulla mappa, «Ultime guide» come
`ClayList`), «Con chi guidi?»/«Parti con» (ricerca incavata, liste per gruppo
e per lettera, durata `ClaySegmented`, auto 3D in card), guida in corso
(testata bianca col volto vero, `ClayMapControls`, Segnala/Termina clay alti
62), riepilogo/percorso (numeri `ClayStat`, mappa in rilievo), «Cosa è
successo?» (tessere bianche che sprofondano), pagellino da Road, informativa,
invito. Ordine del foglio «Parti con» come l'anteprima approvata: durata →
briefing → auto. Resta fuori `RoadLessonCard` (card in agenda, fuori da Road).

**Icone (28/10, design-system §0.9):** le 15 icone Road (12 segnalazioni,
auto 3/4 e dall'alto, emblema) sono 3D generate con l'AI in stile unico,
niente blu, al posto delle Fluent; stessi nomi in `assets/road/` con
`@2x`/`@3x`. Tolte dove bastava il testo: CTA «Compila il pagellino», tasto
«Pagellino» in guida, motivo del briefing, banner «In agenda», card
pagellino e riga agenda nel riepilogo, statistiche, informativa, invito,
sede sulla mappa. Le voci dell'autoscuola usano l'icona di «altro».


## Fluidità (REG-639, 28/10/2026)

- **Store**: `useRoadState()` ridisegna a OGNI cambio (anche ogni fix GPS, ~1/s):
  solo la mappa dal vivo (`app/road/index.tsx`). Altrove `useRoadSelector(s => …)`
  (tab, `RoadController`, riepilogo, segnala, tab Road): prima le tab intere si
  ridisegnavano a ogni fix.
- **Mappa dal vivo**: pin memoizzati (`RoadMarkerPin` con confronto per valore,
  lista in `useMemo` su `markers`), `RoadTrack` memo; ombre dei marker in
  `boxShadow`; l'auto (ombra sulla sagoma PNG) resta `shadow*` con
  `shouldRasterizeIOS`.
- **Dettaglio guida**: `RoadLessonCard` legge `useRoadForAppointment`
  (`src/road/roadAppointmentQuery.ts`, React Query, 5 min, fuori dalla cache su
  file con `meta.persist: false`); l'Agenda fa prefetch al tocco del blocco, così
  la card è al suo posto dal primo fotogramma. La minimappa si monta dopo la
  presentazione del foglio (`InteractionManager` + 120 ms) su un segnaposto
  della stessa misura e compare in dissolvenza.
- **Riepilogo**: trascinarlo giù = «Chiudi» (`FormSheet closeOnGesture`: esce da
  Road); «Avvia guida» non si chiude col gesto mentre parte (`busy`).

## Giro Road (28/10/2026 sera)

- **Note sulla guida dentro Road**: tasto matita in testata (`app/road/index.tsx`, `road-note`) durante la guida; riga «Note sulla guida» (`RoadNotesCard`) nel riepilogo e in «Appena finita». Stesso campo `appointment.notes` (lo vede anche l'allievo: il foglio lo dice) e stesso foglio `edit-notes` (ri-esportato come `road/note` e `drive/note`). La nota esistente si legge con `getAppointments` (allievo + orario) e resta in `src/road/roadNotes.ts`. Nessun cambio backend.
- **«Avvia con Road» nel foglio della guida** (`home/manage-lesson.tsx`): solo se Road è acceso, fase `idle` e `roadStore.eligible.appointmentId === lesson.id` (stesso criterio dell'invito, deciso dal server). Presente/Assente scendono a secondarie affiancate. Sotto «Non ora» dell'invito: «La ritrovi toccando la guida in agenda».
- **Tab Road senza salto all'avvio**: `roadStore.roadKnown`; finché `/road/state` non risponde, `useInstructorTabs` usa `roadEnabled` dalle impostazioni persistite.


### Giro Road — fix velocità «Con chi guidi?» (28/10, dopo OTA 01a183c3)
- **Cambio volto**: anello e volto a tempo fisso (`SELECT_TIMING` 180 ms, niente molla); briefing e testo del bottone `SWITCH_OUT` 80 ms / `SWITCH_IN` 150 ms; per ~0,3 s dopo il tocco le altezze usano `SWITCH_LAYOUT` (200 ms) invece di `ROAD_LAYOUT`/`ROAD_LAYOUT_AFTER_EXIT` (stato `switching` in `drive/index.tsx`).
- **Foto**: `useCachedPhotoUri` fissa l'URI per tutta la vita del componente (prima il primo re-render dopo il download passava dal remoto al file e la foto ripartiva dallo skeleton). `FadeImage` azzera solo a un cambio vero di URI; ease simmetrica 200 ms; skeleton al 10%.
- **Prefetch**: `warmRoadFree()` (dal layout delle tab, una volta per avvio) legge le opzioni di Road e chiama `prefetchRoadFaces` → `prefetchUserPhotos` → `warmPhoto` (file su disco). Ogni URL ricevuto da `userPhotos` va subito sul disco.

### Alleggerimento Road e Allievi (29/10, decisioni di Tiziano)
- **Volti** (`src/components/clay/Avatar.tsx`): una sola ombra esterna; bordino, luce e ombra interna cotti in un'immagine fissa (`assets/clay/avatar-gloss-64|88`). Senza `selected` il volto è statico (niente animazioni); con `selected` (Road) anello a tempo fisso. Su iOS ogni voce di `boxShadow` è uno strato più una maschera, rifatti a ogni cambio di misura: prima erano 5 per volto.
- **Skeleton foto** (`FadeImage` → `SkeletonFill`): respira 5 mezzi cicli (~4 s) e si ferma, mai infinito.
- **Miniature «Ultime guide»** (`RouteThumb` + `src/road/thumbCache.ts`): su iOS la prima volta mappa vera e snapshot (`takeSnapshot`, da `onMapReady`: `onMapLoaded` su iOS non arriva) salvato in `cacheDirectory/route-thumbs/`; poi solo l'immagine. Lo snapshot (MKMapSnapshotter) non applica `showsPointsOfInterest={false}`: può mostrare icone di punti di interesse.
- **Mappa grande**: la tab Road è `lazy: false` (solo per chi ha la tab) e `RoadTab` monta la schermata vera a riposo (`InteractionManager` + 1,5 s) o al primo focus.
- **Allievi** (`InstructorNotesScreen`): `Animated.FlatList` con `ClayNavBar`; tutte le righe montate una volta (`StudentRow` in memo), filtro e ricerca le nascondono con `display: 'none'` e la riga che torna entra in dissolvenza 200 ms; la superficie clay è un unico fondo dietro le righe; settimana (`weekIds`) calcolata una volta sola.

### Road fluida (29/10 pomeriggio, dopo OTA 01a18778)
- **`drive/index.tsx` in sezioni `memo`**: `RoadMap`, `AgendaPanel`, `FaceRow`/`FaceButton`, `BriefStack`, `StartButton`, `RecentSection`. Tolto il timer `switching`. Niente `layout=` né entrate dal basso: solo `ROAD_FADE_IN` (180 ms) / `ROAD_FADE_OUT` (120 ms) quando cambia lo stato del pannello.
- **Cambio allievo**: i briefing dei tre volti (dalle opzioni) sono tutti montati e sovrapposti (`CrossfadeLayer`, riga con `marginLeft: -100%`): la card è alta quanto il più alto e non cambia altezza; dissolvenza incrociata 180 ms sul thread UI. Il testo di «Parti con …» idem, largo quanto la scritta più lunga. Al tocco nessuna chiamata.
- **Opzioni**: la riconferma al focus parte dopo le interazioni e non ridisegna se la risposta è identica (`sameOptions`).
- **Lente «Tutti»** (`avvia.tsx`): `FormSheet` ha la prop `list` (FlatList virtualizzata nello stesso posto dello scroll); un elemento per gruppo (ultime guide, lettere), righe `PersonRow` statiche in memo. Allievi e ore pronti dall'avvio (`refreshRoadStudents` in `warmRoadFree`), riconfermati dopo l'animazione del foglio.
- `BriefingLines`/`BriefingRows` senza entrate a cascata.
- **Allievi**: «I miei / Tutti» → il cursore scorre da solo, la lista cambia 150 ms dopo in `startTransition`; righe e volti della settimana di entrambe le liste già montati (nascosti con `display: none`).

## Punti critici nell'app istruttore (REG-646, 29/10)

Dove gli allievi dell'autoscuola sbagliano più spesso, anche per l'istruttore (decisione di Tiziano, piano `reglo/plans/road/003-punti-critici-e-giro.md`). API del backend REG-643: `GET /road/hotspots?from=` (mappa aggregata dell'autoscuola, soglia 3 errori di almeno 2 allievi) e `GET /road/hotspots/[key]?from=` (per l'istruttore solo le sue guide e i suoi allievi, `hiddenSessions` = quante sono di colleghi); percorsi d'esame da `GET /road/exam-routes`.

| Cosa | Dove |
|---|---|
| Tipi | `src/types/regloApi.ts` (`RoadHotspot`, `RoadHotspots`, `RoadHotspotDetail`, `RoadExamRoute`) |
| Endpoint | `src/services/regloApi.ts` (`getRoadHotspots`, `getRoadHotspot`, `getRoadExamRoutes`) |
| Cache e prefetch | `src/road/hotspotsStore.ts` (`warmRoadHotspots`, `loadHotspots`, `prefetchHotspotDetails`, `prefetchHotspotSessions`, `hotspotSheetStore`) |
| Accesso | riga «Punti critici» nella tab Road (`HotspotsEntry` in `app/(tabs)/drive/index.tsx`, sopra «Ultime guide»): simbolo 3D e via dell'errore più frequente |
| Schermata | `app/(tabs)/drive/punti-critici.tsx` → `src/screens/RoadHotspotsScreen.tsx` (in `FULL_PAGES` di `app/(tabs)/_layout.tsx`) |
| Dettaglio | `app/(tabs)/drive/punto-critico.tsx` (`FORM_SHEET`) → `src/screens/RoadHotspotSheet.tsx` |

- **Schermata**: testata nativa a titolo grande in modalità `overlay` sopra la mappa (`ClayNavBar`), mappa montata una volta nell'intestazione della `FlatList`, non interattiva: aloni rossi (`Circle`, raggio e opacità per numero di errori rispetto al punto peggiore), simbolo 3D dell'errore sul punto (`RoadMarkerPin` piccolo, bordo «da migliorare», ora con `onPress`), percorsi d'esame tratteggiati. Pannello bianco con titolo, riga «N punti negli ultimi 3 mesi», `ClaySegmented` 30 giorni / 3 mesi / 1 anno. Lista = `FlatList` con righe `memo` (`HotspotRow`: simbolo 3D, errore, via · «sul percorso d'esame», numero di errori a destra) sopra un'unica superficie clay dietro le righe (stesso schema di Allievi). Skeleton al primo caricamento, stato vuoto `ClayEmpty` (piantina) con quante segnalazioni ci sono ancora sparse.
- **Foglio del punto** (`FormSheet`, niente CTA): simbolo 3D, via e periodo; tre numeri dell'autoscuola (errori, allievi, guide); «Sul percorso d'esame …»; «I tuoi allievi che ci sbagliano» (volti, errori) e «Le tue guide» (giorno, ora, errori qui) → «Percorso Road» (`drive/road-percorso`, dettaglio da `getRoadSession` già scaricato); nota sulle guide dei colleghi. Massimo 5 righe per lista, poi «e altri N».
- **Fluidità (§15)**: nessun fetch al tocco. La tab Road scalda il periodo di default e i percorsi d'esame a riposo; la schermata scalda gli altri due periodi e i dettagli dei primi 8 punti (uno alla volta); il foglio scalda i percorsi delle prime 6 guide. `from` = inizio del giorno di N giorni fa (chiave di cache stabile per tutto il giorno, anche sul server). Il segmentato anima subito, la lista cambia in `startTransition`. Righe in dissolvenza 180 ms (`ROAD_FADE_IN`), mai `ReduceMotion` che le spenga.
- Solo JS (react-native-maps è già nel binario 2.4.0) → OTA sul runtime 2.4.0.

## Giro della prossima guida nei fogli di partenza (REG-649, 29/10)

Piano: `../reglo/plans/road/003-punti-critici-e-giro.md`. API: `GET /road/plan` (REG-648).

- **`src/road/planStore.ts`**: giri per allievo + durata (`planKey`), scaricati PRIMA del tocco (§15.8): la tab Road per i tre volti (durata di default) e per la guida in agenda, `RoadController` per la guida dell'invito (`prefetchLessonPlan` quando arriva `eligibleLesson`, saltato con `planEnabled: false`), «Avvia guida» per l'allievo scelto e TUTTE le sue durate. Freschi 5 minuti; rete giù = niente giro. `setPlanOrigin` (ultima posizione nota, dalla tab) = partenza del calcolo, altrimenti il server usa la sede. Scelta «Segui il giro» per allievo, in memoria, nasce accesa (`usePlanChoice`); `chosenPlan` / `chosenLessonPlan` = le tappe da mandare all'ingresso (null se spento o vuoto).
- **`src/components/road/RoadPlanCard.tsx`**: `RoadPlanCard` = card clay «Il giro · circa N min», tappe numerate (numero nero, titolo = via o percorso, motivo, minuti di strada) e «Segui il giro» con `ClayToggle`; spento = tappe attenuate (200 ms), l'altezza non cambia. Skeleton della stessa forma mentre arriva; niente giro = niente card. `RoadPlanLine` = il giro in una riga per la tab.
- **Dove**: tab Road › «Con chi guidi?» (una riga nel briefing di ogni volto, dentro gli strati sovrapposti, + tappe numerate e tratteggio sulla mappa in alto con la camera che le abbraccia in 260 ms); pannello «In agenda» (card intera sopra «Entra in Road»); invito `road-invite` (la card prende il posto delle tre righe su Road); foglio della guida `manage-lesson` (sopra «Avvia con Road»); «Avvia guida» passo «Parti con» (dopo il briefing).
- **Partenza**: `beginRoadEntry` / `road-privacy` → `enterRoad(appointmentId, chosenLessonPlan(lesson))`; «Avvia guida» → `enterRoadFree({ …, plan: chosenPlan(studentId, duration) })`. Il server salva le tappe in `RoadSession.plan` (arrivano in `RoadSession.plan` anche nella mobile).
- **Gotcha mappa (react-native-maps 1.20, New Architecture)**: aggiungere/togliere figli di `MapView` al cambio volto fa crashare `AIRMap insertReactSubview` (oggetto nil). Il giro sulla mappa della tab usa posti FISSI (`PlanOverlay`: una `Polyline` e tre `StopMarker` sempre montati, nascosti con colore/opacità), messi PRIMA di auto e sede.
- Perché la tab mostra una riga e non la card intera: i tre briefing sono strati sovrapposti alti quanto il più alto; con la card intera il volto senza giro lasciava un vuoto alto quanto la card degli altri.

## Avvisi delle tappe ed esito del giro (REG-650, 29/10)

- **`src/road/planAlerts.ts`** (puro): `stepPlanAlerts` a ogni punto GPS su `RoadSession.plan.stops`. A ≤ 300 m da una tappa non ancora avvisata → card (la più vicina; una alla volta: se c'è già una card la tappa aspetta il punto dopo la chiusura). Entro 40 m (= `PLAN_REACHED_M` del backend) → tappa raggiunta, anche senza avviso prima. Percorso d'esame: conta il suo inizio. Ogni tappa avvisa una volta sola. Chiusura da sola: avviso 10 s (`PLAN_ALERT_MS`), «raggiunta» 3,5 s (`PLAN_REACHED_MS`), o tocco sulla card. `progressFromTrack` = ripresa dopo un kill (le tappe già toccate dal tracciato del server non riavvisano). `planOutcomeLine` = «Giro: 2 tappe su 3».
- **`roadStore`**: `planAlertsEnabled` (da `/road/state` in `RoadController`, acceso se assente; spento = niente card), `planProgress`, `planAlert`. Il calcolo gira dentro `ingestPoints` (stessi punti filtrati dei km, niente rete); `hydrateFromDetail` riempie `planProgress` dal tracciato del server.
- **`app/road/index.tsx`**: card nera sotto la testata (stessa forma del toast «… segnato»): cerchio bianco con il numero della tappa (✓ quando raggiunta), «250 m · Via Roma» / «Tappa raggiunta · Via Roma», motivo sotto. Vibrazione: colpo `Heavy` all'avviso, `Success` alla tappa raggiunta. I toast della segnalazione e di Road libero scendono sotto la card se ci sono tutte e due. Il timer di chiusura sta nello schermo, così si chiude anche da fermi (senza fix). `RoadToastFrame` ora con `ReduceMotion.Never` (prima seguiva «Riduci movimento»).
- **Riepilogo** (`app/road/riepilogo.tsx`): riga «Giro: N tappe su M» sotto i conteggi, da `summary.planReached` (il server la calcola a «Termina guida»: tracciato entro 40 m, percorso d'esame coperto al 60%); niente riga se la guida non aveva un giro.
- Niente voce, niente indicazioni svolta per svolta. La mappa con linea, tappe e punti dell'allievo è REG-652.
- Verificato sul simulatore contro staging (Aurora Costa, posizione simulata a Torino con `xcrun simctl location booted start --speed=9 …`): avviso a 250 m, «Tappa raggiunta», riepilogo «Giro: 2 tappe su 2».

## Mappa del giro in Road (REG-652, 29/10)

- **`src/road/roadGuide.ts`**: `loadRoadGuide` una volta per sessione all'ingresso in Road (mai durante la guida): `GET /road/plan` per i punti critici dell'allievo (i più ripetuti, max 8) e, se la sessione ha un giro, `POST /road/plan/route` (`regloApi.getRoadPlanRoute`) per la linea suggerita chiusa in sede e l'ordine delle tappe (REG-653). Partenza della linea = `session.last`, altrimenti il **primo fix** del GPS (si aspetta fino a 60 s: appena entrati spesso non c'è e `getLastKnownPosition` sul simulatore è vuoto), poi l'ultima posizione nota. Rete o Routes API giù = niente linea, restano tappe e punti, nessun errore. `orderGuideStops` (ordine del server, chiavi sconosciute = ordine originale), `advanceOnLine` (vertice più vicino davanti, entro 50 m, mai indietro).
- **`roadStore`**: `guide` (`line`, `stops` in ordine, `end`, `hotspots`) e `guidePassed`, aggiornato in `ingestPoints`. Gli avvisi di REG-650 usano `guide.stops`: il numero della card è quello sulla mappa.
- **`src/components/road/RoadGuideOverlay.tsx`** (in `app/road/index.tsx`, PRIMA di percorso, segnalazioni e auto): due `Polyline` (davanti `rgba(17,17,17,0.7)`, già fatta `0.18`, 4 pt, niente blu, dissolvenza 240 ms in JS), 8 posti per i punti dell'allievo (`RoadMarkerPin` `small`, `sentiment="bad"`, `dot={false}`, come REG-646; nuovo prop `hidden`), 3 tappe numerate (cerchio nero; raggiunta = 45%), la sede (se la linea ci arriva). Tutti a **posti fissi** sempre montati (crash `AIRMap insertReactSubview`, vedi REG-649); i posti vuoti stanno sul centro con opacità 0.
- Su staging la sede è a Milano: da Torino la linea finisce all'ultima tappa e la sede non compare (`docs/STAGING.md` del web).
- Il riaggancio dopo una deviazione è REG-654.
