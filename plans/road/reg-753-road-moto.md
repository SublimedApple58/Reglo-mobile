# Piano REG-753 — Road per le guide moto singole

Worktree: `~/Developer/reglo/reglo-mobile-worktrees/reg-753`, branch `feat/reg-753-road-moto` da `origin/master` aggiornato (3bc3d26). Nessun codice scritto.

> **Attenzione: il task non può essere solo mobile.** Oggi il backend esclude del tutto le guide moto da Road (`isRoadEligibleLesson` in `reglo/lib/autoscuole/road/service.ts`, righe 116-117). Senza una piccola modifica lato server, una guida moto non riceve mai l'invito.

## 1. Come si riconosce una guida moto (dato già esistente)
- **Segnale: la patente del veicolo della guida**: categoria `AM | A1 | A2 | A`. In app c'è già `isMotoLicenseCategory` in `src/utils/license.ts`, la stessa regola del backend (`MOTO_CATEGORIES`).
- **Il campo `motoLessonType` (birilli/strada) non basta**: è facoltativo. Lo uso solo per escludere i birilli (vedi domanda 2).
- Non serve una nuova colonna nel database. Il server deve solo mandare la categoria del veicolo dentro la guida di Road (`vehicle.licenseCategory`), che oggi non manda.

## 2. Cosa cambia per l'auto al seguito (punto 1)
**Backend (`reglo/lib/autoscuole/road/service.ts`), piccolo:**
- **Ammettere le moto singole.** `isRoadEligibleLesson` oggi le scarta (righe 116-117). Con la modifica entrano le moto singole; restano fuori gruppi ed esami.
- **Dati della guida.** `lessonDTO` aggiunge `vehicle.licenseCategory` e `followVehicle` (nome e targa dell'auto al seguito, dalla riga `role="follow"` di `AutoscuolaAppointmentVehicle`).
- **«Auto in sede».** Oggi conta come impegnato solo il veicolo della guida. Con una moto in Road, l'auto al seguito comparirebbe «in sede» mentre è in strada. La aggiungo ai veicoli impegnati (riga 1400).

**Mobile, cosa resta uguale:**
- GPS (navigazione auto), percorso, km, segnalazioni, pagellino, avvisi del giro, riepilogo: tutto è già calcolato sul telefono dell'istruttore, quindi funziona da solo nell'auto al seguito.
- La segnalazione cade sulla posizione dell'auto, pochi metri dietro la moto: la lascio così, senza correzioni.
- **Velocità:** in moto il cerchio della velocità mostrerebbe la velocità dell'auto, non quella della moto. È anche il motivo per cui il quadrante prende il suo posto (vedi 3).

**Mobile, unico testo nuovo:** nel foglio d'invito, sotto il nome dell'allievo, una riga grigia «Moto · al seguito con <Auto, targa>». Va solo dove già c'è la riga del veicolo.

## 3. Componenti della schermata Road che tocco
| Cosa | File | Cambio (solo per guida moto) |
|---|---|---|
| Quadrante «Cruscotto» | `app/road/index.tsx` (blocco del cerchio velocità, ~riga 1995) + nuovo `src/components/road/RoadMotoDial.tsx` | Il cerchio della velocità (in basso a sinistra, 62 pt) diventa un quadrante di circa 84 pt: stessa superficie e ombra, stessa posizione. L'arco nero si riempie con tempo trascorso / durata della guida; al centro i minuti, sotto i km. L'arco avanza in 250 ms senza rimbalzo, sul thread UI (react-native-svg + Reanimated, già installati). Notte compresa. |
| Pannello in basso | **non toccato** | Distanza · Segnalazioni · Rientro restano identici. |
| Segnaposto sulla mappa | `src/components/road/RoadLiveCar.tsx` (in movimento) + `RoadMapParts.tsx` (`RoadLiveCarMarker`, mappa libera) + `src/road/markerArt.ts` (nuovo `motoTopArt`) | Moto 3D vista dall'alto al posto dell'auto, stessa misura, rotazione, alone e pulsazione. |
| Foglio d'invito | `app/(tabs)/home/road-invite.tsx` | La moto 3D che già esiste al posto dell'auto e la riga dell'auto al seguito. |
| Tipi e helper | `src/types/regloApi.ts` (`RoadLesson`), piccolo helper `isMotoRoadLesson` | — |

Le guide in auto non cambiano di un pixel.

## 4. Fisso o configurabile
**Fisso e automatico**: si basa sul veicolo della guida. Nessun interruttore nuovo; vale sempre l'interruttore `roadEnabled` dell'autoscuola.

## 5. Account
- **Istruttore** (anche istruttore-titolare): è l'unico che vive Road dal vivo, quindi ha tutto.
- **Titolare:** solo l'effetto sulle «auto in sede».
- **Allievo:** nessuna modifica grafica. Come conseguenza, a guida finita vedrà anche il percorso delle guide moto, se l'autoscuola lo consente.

## 6. Cosa riuso e cosa genero
- **Ho controllato la web app**: `reglo/public` non ha nessuna moto.
- **Già in app:** `assets/icons3d-ai/moto.png`, la moto rossa in vista 3/4 nello stile Reglo. La riuso nel foglio d'invito e come riferimento di forma.
- **Da generare:** solo la moto vista dall'alto per la mappa (oggi c'è solo l'auto vista dall'alto, `auto-su`). Su Gemini, chat nuova, prompt STILE di design-system §0.9, le 2 reference di stile in `docs/assets/icone-ref/` più `moto.png` come terza immagine (regola 4b «stesso oggetto»). Poi scontorno con gli script di §0.9.
- Prima di metterla in app ti mando una tavola d'anteprima.

## 7. Rilascio (quando darai il via)
- Backend prima (staging, poi prod), poi OTA mobile doppia. È solo JS e PNG, nessuna build nativa.
- Le app non aggiornate riceveranno comunque l'invito per le guide moto e mostreranno l'auto: funziona, solo senza la grafica moto.

## Domande
1. **Backend:** ok ad allargare il task a `reglo` (le tre modifiche del punto 2), con branch gemello `feat/reg-753-road-moto` da `origin/staging`?
2. **Birilli:** escludo da Road le guide moto segnate «Birilli»? Sono in area chiusa, l'istruttore è a piedi e il percorso non ha senso. Le «Strada» e quelle senza tipo entrano.
3. **Road libero** (avvio senza guida prenotata): resta solo per l'auto? Se no, servono la scelta della moto e dell'auto al seguito, quindi una funzione nuova.
4. **Colore della moto sulla mappa:** una sola moto rossa come quella dell'app, oppure le 10 tinte del veicolo come per le auto? Le 10 tinte si fanno con `auto-colori.py`, da verificare sulla moto.
5. **Velocità in moto:** la tolgo (il quadrante prende il suo posto), oppure la teniamo piccola sotto il quadrante?

Al tuo ok passo alle anteprime: ritagli in `/tmp/hiro-anteprime/reg-753/` con `HIRO_SHOT`, un solo simulatore e un solo Metro, spenti a fine anteprime.

## Documentazione consultata
- `docs/INDEX.md`, `impact-map.md`, `features/reglo-road.md`, `moto-lesson-type.md`, `student-moto-experience.md`, design-system §0.9: precisi e utili.
- **Lacuna:** né `reglo-road.md` del mobile né l'impact-map dicono che il backend esclude le moto. Lo dice solo il commento in `service.ts`; da aggiungere al feature doc quando chiudiamo.

## Emendamenti (27/11/2026)
- 1) Backend allargato a `reglo`, branch gemello `feat/reg-753-road-moto` (worktree `reglo-worktrees/reg-753`).
- 2) Birilli (Tiziano): non bloccano. Backend: restano idonee, la guida porta `motoLessonType`. App: conferma nativa «Questa guida è segnata come Birilli. La passiamo a Strada e avviamo Road?» → PATCH `motoLessonType: 'strada'` (endpoint esistente `PATCH /api/autoscuole/appointments/[id]`) → avvio.
- 3) Road libero: solo auto.
- 4) Moto nei 10 colori del veicolo (ricolorazione pulita).
- 5) In moto la velocità si toglie: il quadrante prende il suo posto.

## Prompt Gemini della moto vista dall'alto
Blocco STILE di design-system §0.9 + allegati ref1, ref2, moto@3x, poi:

Subject: the SAME red motorcycle as the third attached image (identical design, red body panels, dark grey seat, light grey wheels and engine, same clay material), but seen from DIRECTLY ABOVE (top-down view, straight overhead, like a map icon; ignore the three-quarter camera above). The motorcycle points straight UP: front wheel and handlebars at the top of the frame, rear wheel at the bottom, perfectly vertical and symmetric left-right. Visible from above: the red fuel tank and front fairing, the dark grey seat, the handlebars with small mirrors, the two tyres as narrow dark grey strips at the front and back. Whole motorcycle centered, filling about 85% of the frame height. Plain pure white background, no rider, no floor, no shadow, nothing else.

- 27/11 (Tiziano, dopo le anteprime): passare a Strada NON è obbligatorio. Conferma: «Questa guida è segnata come Birilli» / «Vuoi passarla a Strada?» → «Passa a Strada e avvia» · «Avvia come Birilli» (tipo invariato) · «Annulla».
