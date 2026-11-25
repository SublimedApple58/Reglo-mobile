# Tab dell'allievo: Home · Guide · Scambi · Profilo (REG-786)

Scelta di Tiziano del 24/11/2026: variante V1, anteprime in `/tmp/hiro-anteprime/allievo-tab/v2/` (V1a, V1b, V1c, D1, D2). Correzione del 25/11: «Prenota guida» è la CTA primaria della home.

## Chi la vede
Solo l'allievo in **pratica** (`useStudentPhase().phase === 'PRATICA'`). In attesa e patentato: solo la Home. In teoria: Home (quiz), Profilo, Notifiche, come prima.

| Tab | Route | Note |
|---|---|---|
| Home | `home/index` | gerarchia a tre livelli di REG-784 (`student-booking-exceptions.md`) |
| Guide | `guide/index` → `StudentGuideScreen` | sempre, in pratica |
| Scambi | `swaps/index` → `StudentSwapsScreen` | solo se gli scambi sono accesi (`useSwapEnabled`) |
| Profilo | `settings/index` | la tab «Impostazioni» con il titolo «Profilo» per tutti gli allievi |

Via per l'allievo in pratica: tab **Notifiche** (resta la campanella della home → `home/notifications`; anche il campanello di `NotificationOverlay`) e tab **Note** (diventata la riga «Come stai andando» della tab Guide). Glifi della barra in `AppTabBar` (`STUDENT_ICONS`): calendario, frecce, persona.

## Home
- Via «Le tue guide», «Ultime guide», «Il tuo percorso» (`PathRows`) e la riga «Scambi» di «Altro»: stanno nelle tab Guide e Scambi.
- **CTA primaria `BookCta`** (giro v2, Tiziano 25/11): blocco a sé subito SOTTO la card principale, mai dentro (la card racconta solo la prossima guida: data, orario, sede, istruttore, auto). Bottone nero clay a tutta larghezza «Prenota un'altra guida», sotto in grigio «Hai N guide di credito». Solo se l'allievo può prenotare da sé (`canFreelyBook`, niente pausa né crediti finiti). Senza guide in programma la card grande è `BookPrimaryCard` col bottone «Prenota guida».
- **Con l'esame**: stessa CTA nera (non una riga) sotto la card piccola della prossima guida, mai attaccata alla card dell'esame; senza prossima guida «Prenota guida» sotto la card dell'esame, staccata. Unica riga rimasta: col posto liberato come card grande (la CTA nera lì è «Prendilo»).

## Guide (`src/screens/StudentGuideScreen.tsx`)
Una pagina sola: `ClayNavBar` a titolo grande, `Animated.FlatList` con righe `memo`, skeleton.
- **Dati**: `useAppointments({ studentId: user.id, from: −36 mesi, to: +120 giorni, limit: 500 })`, ramo **pieno** (non `light`): porta `manualPaymentStatus`, `creditApplied` e il pagellino (il server lo manda solo se `studentNotesEnabled`). Cache TanStack condivisa (`['appointments']` invalidato da prenotazioni e annullamenti).
- **Riepilogo**: «Da <mese della prima guida fatta>», N guide fatte, ore al volante (somma delle durate). Copertina `assets/vita/cartina-road` se Road è condiviso con l'allievo (`roadEnabled && studentNotesEnabled`), altrimenti il volante 3D. I km non ci sono: il server non dà all'allievo i percorsi di tutte le guide (`getRoadForStudent` è solo staff) e il task è solo app.
- **Come stai andando** (solo con le note condivise): l'ultimo voto di ogni voce (`studentEvaluationLevels`), la più debole in parole; tocco → `guide/notes` (`StudentMyNotesScreen` con `onBack`).
- **In arrivo**: guide future (esami esclusi, hanno la loro card in home); tocco → `guide/lesson-detail` (stesso foglio della home) con «Cerca sostituto»/«Annulla» via `useStudentLessonActions`; posto di gruppo → `guide/group-lesson-detail`.
- **Fatte**: per mese, le prime 8 e poi «Tutte». Svolte, assenze e annullate dall'allievo (`isPastLesson` in `src/utils/studentLessons.ts`). A destra una parola: «Da pagare» (nero 600, regola `isLessonUnpaid` gemella del backend) > «Assente» (rosso di REG-785) / «Annullata» (grigio) (`LESSON_STATUS_LINE`) > «Pagata» (solo con credito o segnata pagata). Niente importi in euro (REG-780).

## Fogli della guida (REG-789, direzione B «protagonista»)
`FORM_SHEET` ad altezza adattiva, `<FormSheet>` con data come titolo. Niente copertine a tutto sfondo dentro i fogli (regola di Tiziano: solo nelle sezioni), niente pillole di stato. Pezzi condivisi in `src/components/studentLesson/LessonSheetParts.tsx` (`LessonHero`, `LessonPlaceCard` con UNA MapView ferma del ritrovo, `InstructorRow` con chiamata, `VehicleRow` con l'auto 3D nel colore del veicolo, `MarkerRows`, `EvaluationRows`, `evaluationHeadline`).
- **Guida in programma** (`home/lesson-detail`, anche da `guide/`): ora grande, «Urbano · 1 ora con …», card del luogo (mappa se coordinate precise, «Mappe»), istruttore e auto a righe. CTA «Cerca sostituto» / «Revoca richiesta», «Annulla guida» testuale rosso. Riga «Puoi annullarla senza penale fino a …» solo da `penaltyCutoffAt` (lo stesso dato del server; null = autoscuola senza pagamenti né crediti → niente riga). Con una richiesta di scambio aperta: «Se nessun compagno la prende entro <inizio − 1 h>, resta tua.» Una guida già passata (aperta dalle note) usa il foglio della guida fatta.
- **Guida fatta** (`guide/lesson`, `StudentDoneLessonSheet` → `DoneLessonSheetView`, seed in `doneLessonStore`). Il protagonista cambia:
  - con Road (`GET /road/appointments/:id` risponde solo con Road acceso + percorsi condivisi): mappa in card + km/min/«da ripassare» (scheletro finché arriva), poi «Da ripassare» (con l'ora, tocco → mappa) e «Fatto bene» con le icone 3D delle segnalazioni, «Il pagellino di <nome>»; «Da pagare» subito sotto la mappa, «Pagata» in fondo;
  - senza Road e da pagare: salvadanaio 3D grande «Da pagare · Saldala in segreteria.»;
  - senza Road con il pagellino: stella + «Bene in 3 voci su 4» e le voci in card;
  - altrimenti l'auto 3D con tipo e durata.
  Le voci del pagellino in parole (`scoreWord`): «Bene» grigio, «Da rifinire»/«Da rivedere» nero 600.

## Scambi (`src/screens/StudentSwapsScreen.tsx`)
- Dati in cache con `useStudentSwaps` (`['swap-offers']`, `['swap-my-offers']`, aggiornati da push di scambio, `notificationEvents.emitDataChanged` e ogni 30 s mentre la tab è aperta).
- La prima guida dei compagni in evidenza (copertina, «Lasciata da un compagno · domani», «Prendila»), le altre a righe con «Prendi». Prendere chiede conferma (alert nativo), poi `respondSwapOffer`; crediti insufficienti → `swaps/credits-needed` (REG-784).
- «Le tue richieste»: «In attesa», tocco → `swaps/swap-detail` per revocare.
- `home/swaps` (vecchia `SwapOffersScreen`) resta per i link vecchi; le notifiche di scambio aprono la tab (`NotificationInboxScreen`).

## Route riusate in più stack
`guide/lesson-detail`, `guide/group-lesson-detail`, `guide/road-map`, `swaps/swap-detail`, `swaps/credits-needed` ri-esportano le route di `home/`. `home/lesson-detail` apre la mappa nello stack in cui sta (`useSegments`).

## File
`app/(tabs)/_layout.tsx`, `src/components/AppTabBar.tsx`, `app/(tabs)/guide/*`, `app/(tabs)/swaps/*`, `src/screens/StudentGuideScreen.tsx`, `src/screens/StudentDoneLessonSheet.tsx`, `src/screens/StudentSwapsScreen.tsx`, `src/hooks/useStudentSwaps.ts`, `src/hooks/useStudentLessonActions.ts`, `src/stores/doneLessonStore.ts`, `src/utils/studentLessons.ts`, `src/screens/allievoHome/HomeSections.tsx` (`FlatRow` `valueStyle`/`trailing`, `NextLessonCard` `onBook`), `AllievoHomeScreen`, `SettingsScreen` («Le tue guide» solo fuori dalla pratica), `StudentMyNotesScreen` (`onBack`, `lessonDetailPath`), `NotificationOverlay`, `NotificationInboxScreen`.
