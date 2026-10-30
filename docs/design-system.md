# Reglo Mobile — Design System Reference

> Fonte di verita per ogni lavoro UI nell'app.
> Leggi questo documento **prima** di scrivere qualsiasi codice UI.

---

## 0. Clay leggero — il design system dell'app (REG-639, in produzione dal 28/10/2026)

Questo è il design system **com'è oggi in produzione** (master `88c7b1a`, ultimo
OTA iOS 2.4.0 gruppo `6d38f144`). **Dove questa sezione e le successive sono in
conflitto, vince questa**: le sezioni 1–14 sono più vecchie e descrivono anche
componenti superati (badge, chip, BottomSheet con maniglia, gradienti navy).
L'app istruttore/titolare è tutta allineata; nell'app allievo restano da
allineare la testata delle schermate intere (`ClayPageHeader`) e «Le tue
guide» (vedi `plans/reg-639-handoff.md`).

### 0.1 Principi — le regole fisse

1. **Bianco puro e nero.** Fondo pagina e superfici `#FFFFFF`, testo e CTA
   primaria `#111111`. Mai fondi crema, grigi o colorati: il volume non si fa
   col colore di fondo. Niente blu/navy/indaco, niente rosa nella UI (§1).
2. **Clay leggero.** Superfici morbide e tattili ma sobrie: ombra esterna
   morbida + bordo di luce (1px appena scuro che stacca il bianco dal bianco) +
   ombra interna in basso. Gli incavi (ricerca, binari) hanno solo ombra
   interna. Le CTA nere hanno volume (luce interna in alto, ombra interna in
   basso) e premute **sprofondano** (§0.4).
3. **Il colore arriva solo dalle icone 3D e dalle foto** (§0.9). Il resto è
   bianco, nero e grigi neutri.
4. **Niente pillole, badge, tag, eyebrow, pallini colorati.** Lo stato si dice
   con una parola o con un controllo nativo (spunta, casella, interruttore),
   mai con una capsula colorata. Titoli di sezione in minuscolo 17/600, mai
   MAIUSCOLETTO. Mai chip a griglia per scegliere: righe con spunta, stepper,
   segmentato (§0.7).
5. **Peso del testo 500–600**, mai 700/800.
6. **Nativo iOS prima di tutto**: testata a titolo grande che collassa (§0.5),
   form sheet adattivi (§0.6), picker con la spunta, segmentato e menu nativi
   dove servono (`@expo/ui`, §0.7). Riferimento: Impostazioni iOS, Airbnb.
7. **Animazioni sobrie, senza rimbalzo, e MAI spente da «Riduci movimento»**
   (§0.8).
8. **CTA tonde** (capsula `CTA_HEIGHT` 54, raggio 27) e bottoni icona tondi
   (`ClayIconButton` 40). La CTA è sempre l'ultima cosa del foglio, fissa.
9. **La tab bar NON è clay**: resta la «T1 piatta» di REG-638 (§6.19). La
   capsula clay con bolla in rilievo è stata bocciata il 28/10/2026 («sembra la
   versione finta di quella nativa Apple»): non riproporla.

### 0.2 «Vita» — dosata per importanza, mai asettica

Le schermate solo clay (ombre e raggi giusti) erano **asettiche**. Si danno vita
con **oggetti 3D caldi**, **foto**, **un numero che conta** e **micro-copy
umano** («Buongiorno», «Tutte fatte, buon resto di giornata»), sempre su
bianco/nero e senza pillole. Piano: `plans/design-system/reg-639-vita.md`.

**Principio (Tiziano, 28/10/2026): la vita va dosata per importanza.** Le
sezioni chiave ricevono più cura e più 3D, quelle secondarie meno; **mai
uniforme ovunque** (un'icona 3D su ogni riga di ogni pagina è rumore, non vita),
**ma nessuna pagina deve essere asettica**: anche una pagina secondaria ha
almeno un elemento caldo (un numero protagonista, una frase umana, un oggetto
3D nella testata o nello stato vuoto).

| Peso | Dove | Cosa ricevono |
|---|---|---|
| Alto | Agenda, foglio «Nuovo», Disponibilità, «Tu», dettaglio allievo | saluto con l'ora, card «Oggi» col calendario 3D, cartina Road + auto nel colore del veicolo, foto della sede in copertina, ore del mese con le barre delle settimane, statistiche con oggetti 3D |
| Medio | Il mio gruppo, Allievi, Pagamenti, Ore di guida | icone 3D sulle righe principali (gruppo), un numero grande («3 guide da pagare»), sezioni per mese |
| Basso | impostazioni, sottopagine, fogli di modifica | testata pulita, righe native; il calore sta negli stati vuoti (`MORALE_ART`) e nelle frasi |

Dove sta oggi:
- **Agenda**: saluto con l'ora (`greetingFor`: Buongiorno <13, Buon pomeriggio
  <18, Buonasera) sopra il titolo; `AgendaTodayCard` (calendario 3D, «Oggi N
  guide», la prima/la prossima, la pausa; giornata vuota = volante); campanella
  3D sull'avviso «fuori disponibilità».
- **Foglio «Nuovo»**: card clay «Guida» con `cartina-road` e auto
  `car34Art(colore del veicolo esclusivo)` (senza colore: rossa) su un alone
  bianco sfocato (ellisse bianca velata + `boxShadow` bianco: il
  `radial-gradient` su iOS non si disegna); le altre voci con l'oggetto 3D
  libero sul bianco, niente riquadri.
- **Disponibilità**: copertina foto della sede caricata dal titolare
  (`Company.coverPhotoUrl`, dalla web app; senza foto `SEDE_COVER_FALLBACK` =
  `sede-foto`), velo bianco leggero in alto, card che sale sulla copertina con
  la striscia della settimana (`WeekStrip`).
- **Tu**: titolo + volto a destra; `MonthHoursCard` (ore del mese + guide +
  barre delle settimane, settimana in corso nera); un'unica lista, «Esci» in
  fondo. Niente traguardi (bocciati).
- **Il mio gruppo**: righe con oggetto 3D 40 pt (persone, calendario, orologio,
  scambio). **Dettaglio allievo**: volto grande, tre statistiche con volante,
  stella, orologio.

Giro «memorabile» (28/10/2026, piano `plans/design-system/reg-639-memorabile.md`):
ogni schermata dice **il prossimo passo** con una frase e un numero, e ha un
piccolo momento di gioia dove c'è un traguardo vero.
- **Pagamenti**: hero col salvadanaio 3D («3 guide da pagare», la più vecchia),
  «Spunta la casella quando Serena ti paga», si apre su «Da pagare»; spuntata
  l'ultima passa in dissolvenza a «Tutto saldato» col salvadanaio pieno; in
  «Tutte» i mesi vecchi senza niente da riscuotere sono piegati.
- **Dettaglio allievo**: «Prossima guida …» sotto il nome; riga Pagamenti con
  «3 guide da pagare» in nero 600 e salvadanaio 46 pt. **Niente blocco guide
  obbligatorie** (tolto per scelta di Tiziano: né barra, né trofeo, né «6 di 6»).
  Nello storico, senza note resta solo la matita.
- **Agenda**: la card «Oggi» segue la giornata (la prima con chi, quella in
  corso e quando finisce, la prossima, domani); a giornata finita l'espresso.
- **Allievi**: seconda riga = prossima guida / esame e «N da pagare» (grigio,
  nero 600 solo da 3 in su);
  in cima i volti di chi guida con te questa settimana.
- **Dettaglio guida**: guida fatta e non valutata → «Com'è andata Marco?» con la
  stella 3D al posto di «Dettagli guida». **Niente anello «4/6»** delle guide
  obbligatorie (tolto come nel dettaglio allievo).
- **Road**: «Ultime guide» senza percorso = auto 3D nel colore del veicolo;
  segnalazioni a parole («1 da ripassare» in nero, «1 fatta bene»).
- **Disponibilità** «55 h a settimana · 5 giorni»; **Tu** e **Ore di guida**: una
  frase di confronto col periodo prima allo stesso punto, solo se positiva (mai
  «meno di…»); **Il mio gruppo**: «Condividi» il codice d'invito; **Pagellino**:
  la scala a parole («da 1 a 5 stelle») al posto delle stelle gialle.

### 0.3 Token — `src/theme/clay.ts`, `src/theme/spacing.ts`

| Token | Valore | Uso |
|---|---|---|
| `CLAY.bg` / `CLAY.surface` | `#FFFFFF` | fondo pagina e superfici |
| `CLAY.ink` | `#111111` | testo, CTA primaria, cursore segmentato, spunte, casella piena |
| `CLAY.ink2` | `#3A3A3C` | testo di dettaglio forte |
| `CLAY.ink3` | `#6A6A6A` | testo secondario (5.4:1 sul bianco) |
| `CLAY.ink4` | `#8E8E8E` | placeholder, stati spenti («Programmata», righe annullate) |
| `CLAY.hairline` | `rgba(17,17,17,.07)` | separatori leggeri |
| divisori delle liste | `rgba(17,17,17,.12)`, **0.5 pt** | vedi §0.7 (mai `hairlineWidth` su un divisore assoluto) |
| `CLAY_ROW_PRESSED` | fondo `rgba(17,17,17,.045)` | riga premuta, a tutta larghezza |
| `CLAY.chevron` | `#BDBDBD` | chevron |
| `CTA_HEIGHT` / `CTA_RADIUS` | 54 / 27 | CTA a capsula |
| `CLAY_RADIUS.card` | 28 | card, liste |
| `CLAY_RADIUS.tile` | 22 | tessere statistiche, riga auto |
| `CLAY_RADIUS.sheet` | 38 | anteprime; il form sheet nativo usa il suo raggio |
| `FIELD_HEIGHT` | 46 | ricerca e segmentato clay (capsula, raggio 23) |
| `NAV_BAR_H` | 56 | barra della testata sotto la safe area |
| `CLAY_DANGER` | `#C13515` | SOLO testo di azioni distruttive («Esci», «Elimina») |

### 0.4 Volume clay — ombre, luce interna, CTA

Ombre (`CLAY_SHADOW`, si stendono nello style: `[s.card, CLAY_SHADOW.raise]`):

| Preset | Livelli | Uso |
|---|---|---|
| `raise` | bordo 1px · esterna 0/10/24/-10 α.16 · interna 0/-2.5/4 α.035 | card, liste, CTA secondaria a riposo, controlli mappa |
| `raiseSm` | bordo · esterna 0/6/14/-6 α.18 · interna | bottone icona (X), cursore chiaro, bottoni dello stepper |
| `sink` | interna 1px · interna 0/2/5 α.08 | ricerca, binario del segmentato e dell'interruttore, campi |
| `ink` | esterna 0/10/20/-8 α.45 · luce interna in alto · ombra interna in basso | cursore segmentato, bottone nero, toast |
| `inkPressed` | interna 0/2/6 α.55 | storico |
| `avatar` | bordo · esterna 0/4/10/-4 α.22 · interna | volti (foto o iniziali) |

Volume delle CTA (`CLAY_CTA`; la primaria è la variante «gonfia sobria», solo
ombre, niente sfumatura):

| Preset | Fondo | Ombre | Uso |
|---|---|---|---|
| `primary` | `#1E1E1E` pieno | esterna 0/14/24/-10 α.50 · luce interna 0/3/4 bianco α.34 · ombra interna 0/-8/13 nero α.80 | CTA nera a riposo |
| `primaryPressed` | `#1E1E1E` pieno | esterna 0/3/6/-2 α.25 · interna 0/3/8 nero α.70 · luce interna 0/-1/2 bianco α.06 | CTA nera premuta: sprofonda |
| `secondaryPressed` | sfumatura `#F6F6F6` → `#FFFFFF` (70%) | bordo α.06 · esterna 0/2/5/-2 α.14 · interna 0/3/8 α.11 | CTA bianca premuta: sprofonda (a riposo `raise`) |

Lo scambio riposo/premuta è istantaneo (`onPressIn`/`onPressOut`): l'ombra non
si anima, si anima solo la scala di `ClayPressable`.

**Come si fanno in React Native (e quanto costano):**
- **`boxShadow` nativo** (RN 0.81, New Architecture): esterne e `inset: true`
  sullo stesso nodo, più livelli in un array. Niente librerie, niente Skia: è
  solo JS → va in OTA. iOS le disegna dal layer; Android da Android 9 (sotto
  resta il bordo 1px).
- Massimo 3 livelli per preset; in una lista l'ombra va sul **contenitore**,
  mai su ogni riga; **non animare l'ombra** (solo transform e opacity); niente
  blur sui fogli.
- Il nodo con `boxShadow` ha `backgroundColor` e `borderRadius` propri;
  `overflow: 'hidden'` (foto, mappa) su un figlio, mai lì.
- L'ombra **interna** si disegna sotto i figli: su una foto va in un velo
  assoluto sopra il contenuto (vedi `Avatar`).
- **Ombre tagliate, le tre cause**: (1) un antenato con `overflow: 'hidden'` →
  margine interno compensato da uno negativo (`paddingBottom: 28,
  marginBottom: -28`); (2) un fratello bianco disegnato sopra → l'alone resta
  entro lo spazio fra i blocchi (~20 pt; dentro `FormSheet` il centro ha 4 pt
  sopra, 22 di lato, ~18–22 sotto); (3) le vecchie `shadow*` iOS → portarle a
  `boxShadow` (eccezione: ombra che segue un PNG, es. auto sulla mappa).

### 0.5 Schermate intere — testata nativa che collassa scorrendo

**Una sola testata per tutte le schermate intere dell'app istruttore/titolare**:
`ClayLargeTitleScroll` (o `ClayNavBar` + `useLargeTitleScroll` quando lo scroll
è proprio), in `src/components/ClayLargeTitle.tsx`. È la «large title» di iOS:

- **Barra fissa e opaca** sotto la safe area (`NAV_BAR_H` 56): indietro a
  sinistra (`ClayIconButton` `back`, testID `page-back`), azioni tonde a destra
  (`ClayIconButton`, sempre visibili).
- **Titolo grande** 32/600 + riga grigia di contesto 15 come **primo elemento
  dello scroll**; scorrendo sparisce sotto la barra e al suo posto compare il
  **titolo piccolo** 17/600 centrato nella barra (opacità interpolata su
  `scrollY`). La **linea sottile** sotto la barra compare solo quando il
  contenuto ci passa sotto.
- Lo scroll sta **sotto** la barra, non dietro: il pull-to-refresh resta
  visibile.
- `search`: la ricerca si apre **nella barra** (campo con autofocus +
  «Annulla»), come la search bar nativa (Allievi: bottone «cerca» in alto, mai
  un campo grande nel corpo).
- `overlay`: barra trasparente sopra una copertina (foto della sede, mappa di
  Road) che diventa bianca opaca col titolo piccolo quando la copertina passa
  sotto.

In uso: Allievi, Il mio gruppo, Tu e tutte le sottopagine/impostazioni (Aspetto,
Ore di guida, Veicoli, Luoghi, Pagellino, Panoramica istruttori), Notifiche,
Disponibilità (`overlay`), Road (`overlay`). **L'Agenda tiene la sua testata
fissa** (saluto + titolo + bottoni) perché sotto scorre la griglia.
`ClayPageHeader` (testata dentro lo scroll, che non collassa) resta **solo
nell'app allievo**, in attesa del suo giro.

**Copertina elastica** (REG-661, 30/10, `src/components/clay/StretchyCover.tsx`): per le pagine con mappa in alto (home Road, Punti critici). La copertina sta dietro lo scroll; copertina e foglio scorrono insieme; tirando giù la copertina si allarga ancorata in alto (niente vuoto bianco), scorrendo su sale a metà velocità. Con poco contenuto la copertina riempie lo spazio, il foglio arriva alla tab bar e lo scroll si ferma dove finisce il contenuto. Solo transform guidati dallo scroll; cambi di altezza in 220 ms senza rimbalzo.

### 0.6 Fogli — adattivi, testata fissa e opaca, CTA fissa, X, niente grabber

**Un solo foglio per tutto**: rotta con `FORM_SHEET` + componente
`<FormSheet>` (`src/components/SheetScaffold.tsx`); dettagli in §13.2.

- **Altezza adattiva**: il foglio abbraccia il contenuto; se supera lo schermo
  scorre **solo il centro**. Mai page sheet per le liste lunghe.
- **Testata fissa e opaca**: titolo (24/600) + sottotitolo grigio a sinistra,
  **X tonda in alto a destra** (`ClayIconButton`, testID `sheet-close`). Linea
  sottile sotto la testata solo a contenuto scorso.
- **CTA fissa** in fondo (`cta`), bianca, niente fascia grigia; linea sopra
  solo se sotto c'è altro contenuto.
- **Niente grabber/maniglia.** Si chiude con la X, trascinando giù o toccando
  fuori; `busy` spegne il gesto mentre salva, `dirty` chiede conferma nativa
  prima di perdere modifiche, `closeOnGesture` fa eseguire `onClose` al gesto.
  Mai `gestureEnabled: false`.
- Su Android il form sheet taglia la CTA: `TALL_SHEET` + `SheetScaffold`.

### 0.7 Liste e scelte — righe in card clay, spunte, stepper, segmentato

- **Righe in card clay**: `ClayList` è UNA superficie in rilievo con le righe
  dentro; i divisori li mette la lista (`divider`/`first`/`last` passati a ogni
  riga). Righe pronte: `ClayListRow` (volto/icona, titolo, sottotitolo,
  chevron) e le righe da Impostazioni iOS di `src/components/SettingsRows.tsx`.
- **Pressed state a tutta riga, angoli compresi**: `ClayList` ritaglia le righe
  col raggio della card (l'ombra resta fuori dal ritaglio); la riga premuta si
  colora tutta (`CLAY_ROW_PRESSED`) e gli angoli li dà il ritaglio. Il respiro
  di 4 pt sopra la prima riga e sotto l'ultima sta DENTRO la riga
  (`clayRowPadding({ first, last }, base)`); una riga personalizzata si
  dichiara con `markClayRow(Componente)`. Mai un rettangolo che lascia strisce
  bianche. Le icone 3D sulle righe sono trasparenti (§0.9): niente quadrato
  bianco sulla riga premuta.
- **Divisori**: `rgba(17,17,17,.12)`, assoluti in alto alla riga, rientrati di
  18 pt, alti **0.5 pt**. Con `StyleSheet.hairlineWidth` (1/3 pt) un divisore
  assoluto a y frazionaria **non viene disegnato** (giro pagamenti 28/10).
- **Righe da Impostazioni** (`SettingsRows.tsx`): `SettingToggleRow`
  (interruttore `ClayToggle`), `SettingValueRow` (valore grigio + chevron, apre
  un picker o il time picker), `SettingCheckRow` (spunta), `SettingStepperRow`
  (− n + in bottoni tondi `raiseSm`, min/max, haptic).
- **Picker condiviso con spunte nere** (`optionsPickerStore` +
  `select-options`, `OptionsPickerSheet`): righe `SettingCheckRow` in una card
  clay, **spunta nera a destra** sulla voce scelta, niente pallini né bordo
  nero sulla riga. Singola scelta: si applica al tocco e chiude; multipla: CTA
  «Conferma · N». Esempi: Chi prenota, Durate (una riga «30, 45, 60 min» che
  apre la scelta multipla), Allievi del gruppo.
- **Mai chip a griglia**. Numeri → stepper; una voce fra poche → riga con
  valore + picker, o **segmentato**:
  - `ClaySegmented` (binario incavato + cursore clay nero, 200 ms al tocco):
    filtri dentro le schermate clay (Allievi);
  - **segmentato nativo iOS** via `@expo/ui` (`PaymentsFilterSegmented` in
    `src/components/PaymentsFilter.tsx`): sottile, a tutta larghezza, **massimo
    3 voci** che stanno in larghezza (Pagamenti: Tutte · Da pagare · Pagate),
    ripiego `ClaySegmented` dove SwiftUI non c'è (Android, iOS < 17).
- **Controlli nativi `@expo/ui` (SwiftUI)**: già nel binario dalla 2.1.0 (2.4.0
  compresa), quindi vanno in OTA. Si caricano con il ripiego di
  `src/components/SFSymbol.tsx` (`SWIFT_UI`). Nel menu contestuale un `Picker`
  va con `variant="inline"` (lista verticale con la spunta); senza, su iOS 26
  diventa una striscia orizzontale tagliata.
- **Stato di una riga = UN solo segnale.** Esempio Pagamenti: se la guida si
  può segnare, a destra c'è una **casella** (vuota = da pagare, nera con la
  spunta = pagata; un tocco scrive dopo la risposta del server, senza
  conferma); altrimenti lo stato a parole in grigio («Da pagare» in nero 600).
  Informazione secondaria (chi/quando, storico) nel foglio di dettaglio, mai
  sotto la riga.

### 0.8 Animazioni — sobrie, senza rimbalzo, mai spente

- Nulla compare o sparisce di botto, ma **niente overshoot**: timing che
  decelera o spring molto smorzate con `overshootClamping`. Niente curve
  «bouncy»/«elastic».
- Preset: `src/road/motion.ts` (`ROAD_LAYOUT`, `roadEnter`, `ROAD_EXIT`,
  `ROAD_TEXT_IN/OUT`, `ROAD_SPRING`), `SEGMENT_TIMING` (200 ms) per cursori e
  interruttori, `ClayPressable` per la scala al tocco (`cta` .96 · `card` .97 ·
  `small` .92).
- **Mai spente da «Riduci movimento»**: sempre
  `.reduceMotion(ReduceMotion.Never)`, mai `useReducedMotion` per togliere
  un'animazione.
- Si animano solo transform e opacity, mai le ombre. Dettagli in §8.

### 0.9 Icone 3D — poche, trasparenti, generate con l'AI in uno stile unico

**Regole (Tiziano, 28/10/2026 — vincono su §10.2 e sulle note «Fluent»):**

0. **Prima di generare un'icona nuova, controlla se esiste già nella web
   app** (`../reglo/public/images/`: `nav/`, `menu/`, `settings/`, `3d/`,
   `road/`; sorgenti più grandi delle stesse in `../dashboard/images/`) e
   nella tabella «Icone condivise con la web app» qui sotto. Se c'è un
   equivalente si usa QUELLO (REG-672, Tiziano 30/10/2026), anche se una
   versione mobile esiste già.
1. **Meno icone possibili.** Un'icona c'è solo se porta informazione che il
   testo non dà, o dove il testo non ci sta (la mappa), o dove dà la «vita»
   dosata di §0.2. Una CTA nera non ha disegnino.
2. **Le icone che restano sono 3D di alta qualità, generate con l'AI in uno
   stile unico** (blocco STILE qui sotto). Mai icone di pacchetti pronti.
   **Microsoft Fluent 3D Emoji bandite e tolte dall'app**: mai riaggiungerle.
3. **Colori caldi, niente parti grandi nere, niente blu** (anche i cartelli
   che in Italia sono blu si rendono in bianco/nero/grigio o con un oggetto).
   Eccezione: le auto nel colore vero del veicolo.
4. **Sempre PNG TRASPARENTI** (RGBA, `@2x`/`@3x`), mai JPG né fondo bianco
   pieno: su una riga premuta il fondo bianco diventava un quadrato bianco
   («orrendo», giro pagamenti 28/10). L'ombra di contatto resta come velo
   semitrasparente che sfuma prima del bordo.
5. Icone monocromatiche (SF Symbols / Ionicons) solo per i comandi: X, cerca,
   chevron, indietro, «+», «centra», filtro. La tab bar resta a glifi.
6. `<Icon3D source={…} size={…} />`: solo `source`, mai `tintColor`.

**Icone condivise con la web app (REG-672, 30/10/2026)** — copie in
`assets/web/<stesso percorso di public/images>`, con `@2x`/`@3x` ricavate dal
PNG del web (mai ingrandite oltre la sorgente). Si cerca QUI prima di
generare. Il registro resta quello del set (`VITA_ART`, `MORALE_ART`,
`markerArt`, `lessonArt`): cambia solo il file.

| Mobile (chiave / punto d'uso) | File mobile | Web (`public/images/`) | Note |
|---|---|---|---|
| `VITA_ART.calendario` (Blocca, card fantasma, «Oggi», Il mio gruppo) · data in `booking-flow` | `web/nav/agenda-3d` 52 pt | `nav/agenda-3d.png` | sorgente 295 px `dashboard/images/icon-agenda.png` (stessa immagine), margine vuoto tolto |
| `VITA_ART.campanella` (avviso home istruttore) | `web/menu/bell-3d` 30 pt | `menu/bell-3d.png` | margine vuoto tolto |
| `VITA_ART.edificio` (Teoria) · `drive/sede-mancante` · `StudentSettingsSheet` | `web/settings/sede-autoscuola` 96 pt | `settings/sede-autoscuola.png` | |
| `VITA_ART.stella` (pagellino) | `web/menu/feedback-mid` 40 pt | `menu/feedback-mid.png` | il web ha fondo bianco: qui reso trasparente |
| `VITA_ART.termometro` (Malattia) | `web/settings/malattia-icon` 84 pt | `settings/malattia-icon.png` | idem, fondo reso trasparente |
| `MORALE_ART.aeroplanino` (notifiche vuote) | `web/settings/notifica-inviata` 84 pt | `settings/notifica-inviata.png` | fondo bianco: solo su fondo bianco (`ClayEmpty`) |
| Eroe di `AllievoAwaitingScreen` | `web/menu/dai-un-boost` 156 pt | `menu/dai-un-boost.png` | |
| `ROAD_ASSETS.road` (emblema Road) | `web/nav/road-3d` 46 pt | `nav/road-3d.png` | |
| `carTopArt` / `car34Art` (10 tinte) · `lessonArtSource` (schede piccole allievo) | `web/road/cars/auto-{su,34}-<tinta>` 30 / 76 pt | `road/cars/` | il 3/4 del web è 200 px: oltre ~76 pt si sgrana |
| Capitoli teoria · `stat-quizzes` | `icons/chapters/`, `icons/stat-quizzes` | `3d/chapters/`, `road/f-alt.png` | già identici byte per byte |

**Restano mobile di proposito** (scelte di Tiziano 30/10): le 12 segnalazioni
Road `assets/road/f-*`, `s-*` (il web usa ancora le Fluent con il blu: semmai
si portano le mobile sul web); salvadanaio vuoto/pieno (il web ha solo il
maialino rosa vuoto a 176 px); l'auto GRANDE — eroe della home allievo
(`heroArtSource`, `icons3d-ai/auto`) e auto 3/4 da 120+ pt del «+» e del
riepilogo prenotazione (`car34HeroArt`, `assets/road/cars/auto-34-*`).
Tutto il resto non ha un equivalente sul web.

**Inventario:**

| Set | File | Registro | Dove |
|---|---|---|---|
| «Vita» | `assets/vita/` volante, esame (= pagellino), orologio, **salvadanaio** e **salvadanaio-pieno** (76 pt); foto `cartina-road.jpg`, `sede-foto.jpg` | `src/theme/vitaArt.ts` (`VITA_ART`) | Agenda, foglio «Nuovo», Il mio gruppo, dettaglio allievo, Ore di guida, Pagellino, malattia, dettaglio guida («Com'è andata?», stella); **Pagamenti** (hero) e riga Pagamenti del dettaglio allievo (46 pt): salvadanaio = da riscuotere, pieno = tutto saldato |
| Road | `assets/road/` 12 segnalazioni, auto 3/4 grande per colore; emblema e auto piccole da `assets/web/` | `src/road/markerArt.ts` | mappa, griglia segnalazioni, briefing, «Parti con» |
| Allievo / Allievi | `assets/icons3d-ai/` auto (solo eroe), moto, esame, persone, scambio, blocconote, pin | `require` diretto, `src/utils/lessonArt.ts` | home allievo, gruppi, scambi, dettaglio allievo |
| Morale | `assets/morale/` espresso, piantina, trofeo, esame (84 pt); aeroplanino da `assets/web/` | `src/theme/moraleArt.ts` (`MORALE_ART`) | SOLO stati vuoti (`ClayEmpty`), traguardo ore, testata del foglio esame |
| Web (REG-672) | `assets/web/` (tabella sopra) | registri dei set qui sopra | ovunque esista un equivalente nella web app |
| Teoria (vecchie) | `assets/icons/` `stat-*`, `cta-*`, `chapters/` | `require` diretto | percorso teoria allievo: da rifare con questo metodo quando si tocca la teoria |

**Formato:** segnalazioni 48 pt, righe 40 pt, «vita» 64 pt (64/128/192 px),
emblema 36 pt, auto 3/4 80×65 pt, auto dall'alto 30×46 pt. ~2–15 KB a file.

**Blocco STILE per Gemini (da incollare identico):**

```
Premium 3D icon in the spirit of Airbnb's 2025 app icons: a real-world
object, softly simplified, friendly but adult, few clean shapes, readable at
small size. Material: matte satin soft-touch plastic, slightly puffy edges,
generous rounded bevels. Light: one large soft key light from the top-left,
faint warm fill from the right, thin rim light on top edges, soft ambient
occlusion; gentle highlights only. Camera: three-quarter view from slightly
above (about 25 degrees elevation, object turned about 30 degrees to the
left), long lens, object centered and filling about 78% of a square frame.
Background: plain pure white #FFFFFF, perfectly flat and uniform, no floor,
no cast shadow, no vignette. Palette: off-white #F4F2EE, warm light greys,
near-black #1A1A1A details, one accent only where stated (signal red
#E5484D, amber #F5A524, leaf green #2FA36B). No blue anywhere, no pink, no
purple. No emoji style, no cartoon faces, not photorealistic, no logos, no
watermark. Square 1:1.
```

Poi una riga `Subject: …` con l'oggetto, i materiali e i colori dei dettagli
(caldi, niente parti grandi nere). Per una vista diversa (es. dall'alto per la
mappa) dirlo nel soggetto e chiedere di ignorare la camera di 3/4. I prompt
delle 15 icone di Road sono in `plans/design-system/reg-639-icone-3d.md`.

**Reference di stile (allegarle a OGNI generazione):**
`docs/assets/icone-ref/ref1.png` (griglia di oggetti 3D) e
`docs/assets/icone-ref/ref2.png` (oggetti 3D premium su bianco). Sono le due
reference di Gabriele con cui è stato approvato il metodo il 28/10/2026.

**Metodo (approvato da Tiziano il 28/10/2026):**

1. **Gemini**, account Reglo, **una chat nuova per ogni immagine**: blocco
   STILE + `Subject: …` + **le 2 reference** allegate. Si genera su bianco puro.
2. **Se Gemini resta bloccato oltre 2 minuti** (generazione che non finisce,
   nessuna immagine), ci si ferma e si riprova **in una chat nuova**; non si
   aspetta oltre.
3. **PNG trasparente**: scontorno con gli strumenti in `docs/assets/icone-3d/`
   — `mask.swift` (soggetto ritagliato da macOS Vision) e `scontorna.py`
   (bianco → alfa fuori dal soggetto, ombra che sfuma ai bordi, 1x/@2x/@3x con
   ridimensionamento in alfa premoltiplicato, niente alone). Istruzioni in
   testa allo script. Su bianco il risultato è identico all'originale.
   Controllo: comporre l'icona su bianco, su `#F5F5F5` (riga premuta) e su
   scuro, e guardare che non resti fondo né alone.
4. Le auto si generano UNA volta (rossa) e le altre tinte si ottengono
   ricolorando la carrozzeria (maschera sui rossi, esclusi vetri e gomme).
4b. **Varianti dello stesso oggetto** (es. salvadanaio → salvadanaio pieno,
   giro «memorabile» 28/10): chat nuova con le 2 reference **più l'icona già
   approvata come TERZA immagine**, e nel `Subject:` «the SAME <oggetto> as the
   third attached image (identical shape, colour, camera angle and size in
   frame), now …». Così forma, materiale e inquadratura restano identici e le
   due icone si scambiano senza salti.
5. **Anteprima** su tavola (grande · misura reale · su riga premuta) in
   `/tmp/hiro-anteprime/<task>/` e **ok di Tiziano** prima di metterla
   nell'app.

**Autorizzazione:** le sessioni di sviluppo sono AUTORIZZATE da Tiziano a usare
il Mac a CONTROLLO COMPLETO (usa_il_mac, non limitato a Chrome) per generare le
icone su Gemini, senza chiedere.

### 0.10 Componenti — `src/components/clay/` (import da `src/components/clay`)

| Componente | Cosa | Note |
|---|---|---|
| `ClayPressable` | base premibile: scala a molla senza rimbalzo (`cta` .96 · `card` .97 · `small` .92) | ex `RoadPressable` (alias) |
| `ClayButton` | CTA a capsula `primary` (nero gonfio) / `secondary` (bianco `raise`); `compact` 46; `leading`; `loading` = spinner (mai cambio di etichetta) | premute sprofondano |
| `ClayIconButton` | cerchio 40 (`lg` 50), bianco `raiseSm` o nero `ink`; `icon` = `close`/`back`/`add` o un nodo (SF Symbol) | X di tutti i fogli, azioni della testata |
| `ClaySurface` | card: bianco in rilievo, raggio 28, padding 20 (`padded={false}` a filo); con `onPress` premibile | `overflow: hidden` su un figlio |
| `ClayList` + `ClayListRow` | lista in card clay, divisori automatici, pressione a tutta riga (§0.7) | ombra sulla lista, non sulle righe |
| `ClaySection` | titolo di sezione 17/600 in minuscolo, `action` testuale a destra, contenuto, `footnote` grigia | mai eyebrow |
| `ClaySearchField` | capsula incavata 46, lente monocromatica | nella testata con `search` |
| `ClaySegmented` | segmentato clay: binario incavato + cursore nero, 200 ms al tocco, etichette in dissolvenza incrociata | haptic di selezione |
| `ClayToggle` | interruttore clay: binario incavato che si riempie di nero, pallino bianco in rilievo, 200 ms | mai `Switch`, mai giallo |
| `ClayField` | campo: etichetta 15/500 sopra, campo incavato (`sink`, raggio 16), nota/errore sotto | `forwardRef` |
| `Avatar` | foto o iniziali su `avatarColors`, volume clay, anello nero se `selected` | |
| `ClayStat` / `ClayHeroNumber` | tessera icona 3D + numero + etichetta; numero protagonista | cifre tabellari |
| `Icon3D` | icona 3D colorata, solo `source` (§0.9) | |
| `ClayEmpty` | stato vuoto: icona morale 84 pt, titolo, una riga, azione facoltativa | mai un riquadro grigio |
| `ClayMapControls` | colonna bianca 56: velocità + «centra» | Road |

Fuori da `src/components/clay/`:

| Componente | Cosa |
|---|---|
| `ClayLargeTitleScroll` / `ClayNavBar` / `useLargeTitleScroll` (`ClayLargeTitle.tsx`) | testata nativa che collassa (§0.5) |
| `FormSheet` / `SheetCloseButton` (`SheetScaffold.tsx`) | IL foglio (§0.6, §13.2) |
| `SettingToggleRow` / `SettingValueRow` / `SettingCheckRow` / `SettingStepperRow` (`SettingsRows.tsx`) | righe da Impostazioni iOS (§0.7) |
| `OptionsPickerSheet` (+ `optionsPickerStore`, rotte `select-options` / `select-options-long`) | picker condiviso con spunte nere |
| `PaymentsFilterSegmented` (`PaymentsFilter.tsx`) | segmentato nativo iOS `@expo/ui` con ripiego clay |
| `SFSymbol` (`SFSymbol.tsx`) | SF Symbol nativo + `SWIFT_UI` (caricamento sicuro di `@expo/ui`) |
| `ClayAccountParts` | `ProfileSummaryCard`, `ClayTextRow` (`danger` = `CLAY_DANGER`), `AppVersionFooter` |
| `AgendaTodayCard`, `MonthHoursCard`, `WeekStrip` | le card «vita» di Agenda, Tu, Disponibilità |
| `ClayPageHeader` | SOLO app allievo, da sostituire con la testata di §0.5 |
| Tab bar | NON clay: «T1 piatta» (§6.19) |


---

## 1. Palette Colori

> **Via il blu (REG-638, 27/10/2026), su TUTTA l'app** (allievo, istruttore,
> titolare, login, onboarding): `colors.primary` = **`#111111`** come il web e
> Road; la scala brand si chiama `ink` (`navy` resta come alias deprecato, con
> valori neutri: 50 `#F4F4F4` · 100 `#EBEBEB` · 200 `#D9D9D9` · 300 `#B0B0B0` ·
> 400 `#6A6A6A` · 500 `#111111`). CTA nere piene, logo nero, icona e splash neri
> (nativi: arrivano con la build). Grigi solo **neutri** (niente slate bluastri),
> nessun blu/indaco/navy. Restano i colori di stato (verde/rosso/ambra), il giallo
> e il viola degli esami, la palette agenda scelta dal titolare
> (`agendaColors.ts`, allineata al web). Dove sotto si legge «navy» oggi vale nero.

### 1.1 Token Semantici

Definiti in `src/theme/colors.ts` → oggetto `colors`:

| Token | Hex | Uso |
|---|---|---|
| `colors.primary` | `#1A1A2E` | CTA principali, bottoni primari, tint tab bar, focus input, dot calendario, ombra CTA |
| `colors.accent` | `#FACC15` | Card "prossima guida", day pill selezionato, chip attivi, border today calendario |
| `colors.destructive` | `#EF4444` | Errori, annullamenti, azioni distruttive, toast danger |
| `colors.positive` | `#22C55E` | Successo, conferme, stati completati, toast success, icona celebrazione |
| `colors.textPrimary` | `#1F2937` | Testo principale, titoli, Card dark bg |
| `colors.textSecondary` | `#6B7280` | Testo secondario, descrizioni, frecce navigazione |
| `colors.textMuted` | `#9CA3AF` | Placeholder, label terziarie, weekday calendar headers |
| `colors.border` | `#E5E7EB` | Bordi card, separatori, bordi pulsanti freccia |
| `colors.surface` | `#FFFFFF` | Sfondo card |
| `colors.background` | `#FDFDFD` | Sfondo pagina + tab bar (off-white che sfiora il bianco, mai bianco puro). Tab bar (`GlassTabBar`) e fallback Android degli header blur (`rgba(253,253,253,…)`) usano lo stesso valore. |
| `colors.shadow` | `rgba(0, 0, 0, 0.08)` | Ombra base generica |

### 1.2 Regola d'oro: **70 / 20 / 10**

- **70% neutri** — bianco, grigi, testo scuro
- **20% navy** — CTA, accenti interattivi, focus state
- **10% giallo** — highlight informativi, prossima guida, selezioni temporali

### 1.3 Scale Colori

Accesso diretto via `colors.navy[shade]` e `colors.yellow[shade]`:

**Navy (mono)**
| Shade | Hex | Uso principale |
|---|---|---|
| `50` | `#F4F5F9` | Badge default bg, clock circle bg (RangesEditor), ring celebrazione |
| `100` | `#E9EBF2` | — |
| `200` | `#D6D9E6` | Badge default border, ring BookingCelebration |
| `300` | `#AEB4CC` | — |
| `400` | `#6E7596` | — |
| `500` | `#1A1A2E` | = `colors.primary` |
| `600` | `#14141F` | — |
| `700` | `#0D0D16` | — |

**Giallo (Yellow)**
| Shade | Hex | Uso principale |
|---|---|---|
| `50` | `#FEFCE8` | Badge warning bg, info card modale bg |
| `100` | `#FEF9C3` | `statusScheduledBg`, sfondo day today calendario |
| `200` | `#FEF08A` | Badge warning border |
| `300` | `#FDE047` | — |
| `400` | `#FACC15` | = `colors.accent` |
| `500` | `#EAB308` | — |
| `600` | `#CA8A04` | = `statusScheduledText` |
| `700` | `#A16207` | Testo Button secondary, testo chip attivo |

### 1.4 Colori di Stato (Token)

| Token | Hex | Uso |
|---|---|---|
| `colors.statusScheduledText` | `#CA8A04` | Testo "Programmato" |
| `colors.statusScheduledBg` | `#FEF9C3` | Background badge programmato |
| `colors.statusCompletedText` | `#64748B` | Testo stato completato |

### 1.5 Colori Ausiliari (Inline, Non Tokenizzati)

Usati direttamente negli stili dei componenti:

| Hex | Contesto d'uso |
|---|---|
| `#F8FAFC` | Sfondo input non focused, sfondo SkeletonCard, sfondo time picker scroll container |
| `#E2E8F0` | Bordo input non focused, bordo chip inattivo, underline orario, testo day otherMonth (calendario) |
| `#1E293B` | Testo forte in drawers (CalendarDrawer, TimePickerDrawer), toast info bg |
| `#0F172A` | Toast info shadow |
| `#64748B` | Testo time picker non selezionato, icona add (RangesEditor) |
| `#94A3B8` | Label colonne time picker, weekday headers, frecce disabilitate, hint mascot, icona info toast |
| `#92400E` | Testo selezionato time picker, testo chip attivo (SelectableChip) |
| `#CBD5E1` | Handle drag drawers, testo day non disponibile (calendario) |
| `#B45309` | Ombra ambra card accent (uso inline) |
| `#D97706` | Ombra ambra day pill |
| `#16A34A` | Badge success text, toast success shadow |
| `#BBF7D0` | Badge success border |
| `#F0FDF4` | Badge success bg |
| `#DC2626` | Badge danger text, toast danger shadow |
| `#FECACA` | Badge danger border |
| `#FEF2F2` | Badge danger bg |
| `#FDE68A` | Border info card modale gialla |

### 1.6 Token Deprecati

Gli alias deprecati (`colors.navy` stringa, `colors.glass`, `colors.glassStrong`, `colors.glassBorder`) sono stati **rimossi** da `colors.ts`: erano inutilizzati. `colors.navy` ora è la **scala navy** (oggetto `50…700`), non più una stringa. Usare `colors.primary` / `colors.surface` / `colors.border`.

---

## 2. Typography

Definiti in `src/theme/typography.ts`:

| Token | fontSize | fontWeight | letterSpacing | Uso |
|---|---|---|---|---|
| `typography.title` | 28 | `'700'` | -0.3 | Titoli pagina ("Ciao, Gabriele") |
| `typography.subtitle` | 18 | `'600'` | — | Titoli card, sezioni, header BottomSheet |
| `typography.body` | 15 | `'500'` | — | Testo corrente, label bottoni, input text, option label |
| `typography.caption` | 12 | `'600'` | 0.4 | Badge testo, label piccole, metadata, action pill |

### Varianti Tipografiche nei Componenti

I componenti applicano override specifici ai token base:

**Card — titoli per hierarchy:**
| Hierarchy | fontSize | lineHeight | fontWeight | letterSpacing |
|---|---|---|---|---|
| `primary` | 30 | 34 | `'700'` | -0.4 |
| `secondary` | 22 | 27 | `'700'` | — |
| `tertiary` | 18 | 23 | `'600'` | 0 |

**Card — sottotitoli per hierarchy:**
| Hierarchy | fontSize | lineHeight | fontWeight |
|---|---|---|---|
| `primary` | 16 | 22 | `'600'` |
| `secondary` | 14 | 19 | `'500'` |
| `tertiary` | = `typography.caption` | — | — |

**SectionHeader — titoli per hierarchy:**
| Hierarchy | fontSize | lineHeight | fontWeight | letterSpacing |
|---|---|---|---|---|
| `primary` | 22 | 27 | `'700'` | -0.2 |
| `secondary` | 19 | 24 | `'700'` | — |
| `tertiary` | 17 | 22 | `'600'` | — |

---

## 3. Spacing

Definiti in `src/theme/spacing.ts`:

| Token | Valore (px) | Uso tipico |
|---|---|---|
| `spacing.xs` | 6 | Gap minimi, padding badge verticale, micro gap |
| `spacing.sm` | 10 | Gap card content, padding chip verticale, gap BottomSheet body |
| `spacing.md` | 16 | Padding standard, gap card primary, margin month nav |
| `spacing.lg` | 22 | Padding card, padding BottomSheet, padding drawer |
| `spacing.xl` | 28 | — |
| `spacing.xxl` | 36 | — |

---

## 4. Border Radius

Definiti in `src/theme/spacing.ts` → `radii`:

| Token | Valore (px) | Quando usarlo |
|---|---|---|
| `radii.sm` | 20 | Bottoni, input, chip, toast, suggerimenti SearchableSelect, CTA footer drawer |
| `radii.lg` | 35 | Card primary, SkeletonCard |
| **`CTA_RADIUS`** | **27** (= `CTA_HEIGHT` 54 / 2) | **Tutte le CTA, primarie e secondarie: capsula** (regola Tiziano 27/10/2026) |

> **CTA a capsula (Tiziano, 27/10/2026).** Si usa sempre la CTA più tonda che
> l'app aveva già: raggio = metà altezza. `CTA_HEIGHT`/`CTA_RADIUS` in
> `src/theme/spacing.ts`; per bottoni più bassi vale lo stesso principio
> (40 → 20, 50 → 25). Censimento del 27/10: 31 CTA erano già 54/27; Road è
> allineata. Restano da allineare (r < h/2), da fare col via di Tiziano:
> Login, Signup, PasswordReset (54/15), AuthWelcome (56/16), PhoneGate e
> LicensePathGate (58/18), InstructorLink e InstructorQrScanner (52/16),
> NotificationOverlay e AllievoHome (54/20).

### Radii Inline (Non Tokenizzati)

| Valore | Contesto |
|---|---|
| `999` | Badge pill, SelectableChip, action pill SectionHeader, RangesEditor row, add button |
| **`26`** | **CTA card (Airbnb-style)** — Simulazione, Esercitazione, Continua a studiare, Ripassa errori, card capitolo in topic list |
| `24` | Modal card centrata, BottomSheet top radius |
| `28` | CalendarDrawer top radius |
| `22` | BookingCelebration card |
| **`20`** | **Stats inset card** (informativa), card deboli, card sessioni |
| **`18`** | **Schede tile** (griglia schede capitolo e esame), frecce navigazione mese |
| `17` | Frecce CalendarNavigator (circle 34x34) |
| **`16`** | **Bottoni VERO/FALSO quiz**, card base default, info card modale |
| `12` | Item time picker |
| `10` | SkeletonBlock default |
| `CELL_SIZE/2` | Day cell calendario (cerchio perfetto) |

**Regola**: CTA (bottoni d'azione) → capsula `CTA_RADIUS`. CTA card → `26`. Info card → `20`. Tile griglia → `18`. Bottoni VERO/FALSO quiz → `16`. Pill/chip → `999`. Cerchi → dimensione/2.

---

## 5. Ombre (Shadow Presets)

### 5.0 Principio: Raised vs Recessed

Le ombre comunicano la gerarchia interattiva:
- **Ombra esterna (raised)** = tappabile, azione. L'elemento "galleggia" sopra la pagina.
- **Ombra interna (inset/recessed)** = informativo, non tappabile. L'elemento e' "incassato" nella pagina.

**Mai** dare ombra esterna a card informative. **Mai** dare inset shadow a CTA.

### 5.1 CTA Card — Ombra Concentrata (v3)

Usata da: card Simulazione, Esercitazione, Ripassa errori, card capitolo (topic list), tile schede.
L'ombra e' stretta e vicina alla card → effetto "oggetto sollevato dal tavolo", non alone diffuso.

```ts
shadowColor: '#000',
shadowOffset: { width: 0, height: 3 },
shadowOpacity: 0.14,
shadowRadius: 6,
elevation: 5,
```

**Press state:**
```ts
opacity: 0.9,
transform: [{ scale: 0.96 }],
```

### 5.2 CTA Primary — NERO PIENO (regola REG-638, 27/10/2026; prima gradiente navy)

Dal «via il blu» (REG-638) la CTA primary è **nero pieno `#111111`** come in
Reglo Road e sul web: niente navy, niente gradiente. I componenti restano gli
stessi (l'API non cambia, il «gradiente» ha un solo colore). Componenti in `src/components/GradientCTA.tsx`:

- **Bottone nuovo** → `<Button tone="primary" />` (già gradiente) oppure
  `Pressable` (radius+shadow) + `<GradientCTA style={...}>` come fill.
- **Bottone esistente / conversione** → `<GradientCTABackground radius={R} />`
  come PRIMO figlio del Pressable + rimuovere `backgroundColor` dallo style
  (layout/ombre invariati). `R` = il borderRadius dello style.
- Colore: `PRIMARY_GRADIENT = [colors.primary, colors.primary]` (nero pieno).
- Ombra OBBLIGATORIA sul Pressable: `primaryCtaShadow` (shadowColor `#000`,
  opacity 0.16, radius 12, offset 0/6, elevation 5) — leggera, stile Road. Mai ombre
  ad-hoc sui CTA gradient: sempre `...primaryCtaShadow` spread nello style.
  Se il gradiente è condizionale (varianti navy/disabled), l'ombra segue la
  STESSA condizione. Il view che porta l'ombra non deve avere
  `overflow: 'hidden'` (iOS la clipperebbe).
- La forma NON cambia mai: pill restano pill, radius restano i loro.
- **Eccezione**: `ForceUpdateScreen` resta navy flat (pure-JS safety net, non
  deve importare moduli nativi).

**Press state:**
```ts
opacity: 0.95,
transform: [{ scale: 0.97 }],
```

### 5.3 Tile Schede — Ombra Leggera

Usata da: griglia schede capitolo, griglia schede esame.

```ts
shadowColor: '#000',
shadowOffset: { width: 0, height: 3 },
shadowOpacity: 0.1,
shadowRadius: 5,
elevation: 3,
```

### 5.4 Card Informativa — Inset Shadow (v3)

Usata da: stats home, stats topic list, stats scheda grid, stats exam schede.
Usa `boxShadow` nativo di React Native 0.81+ con `inset: true`.

```ts
backgroundColor: '#EEEDEB',
borderRadius: 20,
boxShadow: [
  { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.12)', inset: true },
  { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.06)', inset: true },
],
```

Due layer: uno morbido (blur 6) + uno nitido (blur 2) per profondita' realistica.

### 5.5 Card Secondaria — Ombra Leggera

Usata da: countdown esame, capitoli da migliorare, card generiche non-CTA.

```ts
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.06,
shadowRadius: 10,
elevation: 2,
```

### 5.6 BottomSheet / CalendarDrawer

```ts
shadowColor: 'rgba(0, 0, 0, 0.08)',
shadowOpacity: 0.12,
shadowRadius: 18,
shadowOffset: { width: 0, height: -6 },
elevation: 6,
```

### 5.7 Day Pill Calendario (Selezionato)

```ts
shadowColor: '#D97706',
shadowOpacity: 0.18,
shadowRadius: 6,
shadowOffset: { width: 0, height: 3 },
elevation: 3,
```

### 5.7 Toast Notice

**Regola (Tiziano 28/10/2026)**: il toast sta solo nelle schermate piene, in
alto sotto la status bar. **Mai dentro un foglio** (`FormSheet`): lì si
posizionava a metà del foglio, sopra il contenuto. Nei fogli il risultato si
vede sulla riga o sull'interruttore (casella che si riempie, riga che esce con
un collapse), gli errori li dice un `Alert` nativo. Stile: bianco, glifo
monocromatico nero (rosso solo per l'errore), **nessuna barretta di
avanzamento**. Pattern di riferimento: feedback della casella in Pagamenti
(`docs/features/lesson-payments.md`).
Contenuto che si chiude in altezza dentro un `FormSheet`: chiamare
`useSheetAnticipate()(px)` all'inizio dell'animazione, così il foglio si
accorcia nello stesso movimento e non dopo.

```ts
shadowColor: /* varia per tone (vedi sezione ToastNotice) */,
shadowOpacity: 0.3,
shadowRadius: 16,
shadowOffset: { width: 0, height: 8 },
elevation: 10,
```

### 5.8 BookingCelebration Card

```ts
shadowColor: 'rgba(0, 0, 0, 0.08)',
shadowOpacity: 0.12,
shadowRadius: 20,
shadowOffset: { width: 0, height: 10 },
elevation: 16,
```

### 5.9 SearchableSelect Dropdown

```ts
shadowColor: '#000',
shadowOpacity: 0.1,
shadowRadius: 16,
shadowOffset: { width: 0, height: 8 },
elevation: 8,
```

### 5.10 RangesEditor Row

```ts
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.05,
shadowRadius: 8,
elevation: 2,
```

### 5.11 Backdrop Overlay

| Contesto | Valore |
|---|---|
| BottomSheet | `rgba(10, 15, 30, 0.45)` |
| CalendarDrawer | `rgba(0, 0, 0, 0.35)` |
| BookingCelebration | `rgba(14, 24, 40, 0.16)` |
| Modal centrata | `rgba(0, 0, 0, 0.35)` |

---

## 6. Componenti

Tutti in `src/components/`. **Non creare nuovi primitivi** — usa e componi questi.

### 6.1 Screen

**File:** `Screen.tsx`
**Scopo:** Wrapper SafeArea per ogni schermata.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `children` | `ReactNode` | — | Contenuto della schermata |

Stili: `flex: 1`, `backgroundColor: colors.background`, `paddingTop: insets.top`.

---

### 6.2 Card

**File:** `Card.tsx`
**Scopo:** Contenitore generico con gerarchia visiva.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `title` | `string?` | — | Titolo opzionale |
| `subtitle` | `string?` | — | Sottotitolo opzionale |
| `children` | `ReactNode?` | — | Contenuto custom |
| `style` | `ViewStyle?` | — | Override stile container |
| `hierarchy` | `'primary' \| 'secondary' \| 'tertiary'` | `'secondary'` | Livello gerarchico |
| `variant` | `'default' \| 'dark'` | `'default'` | Variante colore |
| `titleStyle` | `TextStyle?` | — | Override stile titolo |
| `subtitleStyle` | `TextStyle?` | — | Override stile sottotitolo |

**Stili base:** `borderRadius: 16`, `borderWidth: 1`, `borderColor: colors.border`, `bg: colors.surface`, `padding: spacing.lg`, `gap: spacing.sm`.

| Hierarchy | borderRadius | shadowOpacity | shadowRadius | elevation | paddingVertical | gap |
|---|---|---|---|---|---|---|
| `primary` | `radii.lg` (35) | 0.12 | 12 | 4 | `spacing.lg` | `spacing.md` |
| `secondary` | 16 | 0.08 | 8 | 2 | `spacing.lg` | `spacing.sm` |
| `tertiary` | 16 | 0.08 | 8 | 2 | `spacing.md` | `spacing.xs` |

**Variant `dark`:** `bg: #1F2937`, `borderColor: rgba(255,255,255,0.1)`, testo bianco, sottotitolo `rgba(255,255,255,0.7)`.

---

### 6.3 Button

**File:** `Button.tsx`
**Scopo:** Bottone standard per azioni.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string` | — | Testo del bottone |
| `onPress` | `() => void?` | — | Handler tap |
| `tone` | `'standard' \| 'primary' \| 'danger' \| 'secondary'` | `'standard'` | Tono visivo |
| `disabled` | `boolean` | `false` | Stato disabilitato |
| `fullWidth` | `boolean` | `false` | Larghezza piena |
| `loading` | `boolean` | `false` | Mostra `ActivityIndicator` al posto della label |

**Stili base:** `borderRadius: radii.sm` (20), `borderWidth: 1`, `minHeight: 48`, `paddingVertical: spacing.sm`, `paddingHorizontal: spacing.lg`.

**Loading:** quando `loading` è `true` il bottone mostra uno **spinner** (`ActivityIndicator`, colore = `text` del tone) **al posto della label, che NON cambia testo** (no "Salvataggio…/Prenotazione…/Spostando…"). Il press è disabilitato. Regola di prodotto: per azioni async usare **sempre** lo spinner, mai lo swap di label. Vale anche per le pill custom (CTA picker, conferme): `pending ? <ActivityIndicator color="#fff" /> : <Text>label</Text>`.

**Spinner sul bottone CLICCATO:** se più bottoni async convivono (es. Cancella/Mantieni in una card), lo spinner deve apparire **sul bottone effettivamente premuto**, non su un fratello. Non basta un flag per-riga: tracciare `{ id, action }` e mettere `loading` solo sul match; gli altri restano `disabled`.

| Tone | bg | border | text |
|---|---|---|---|
| `primary` | `#1A1A2E` | `#1A1A2E` | `#FFFFFF` |
| `standard` | `#FFFFFF` | `colors.border` | `colors.textPrimary` |
| `danger` | `#FFFFFF` | `#EF4444` | `#EF4444` |
| `secondary` | `#FFFFFF` | `#FACC15` | `#A16207` |

**Pressed:** `scale: 0.98`. **Disabled:** `opacity: 0.6`, label color → `colors.textMuted`.

---

### 6.4 Badge

**File:** `Badge.tsx`
**Scopo:** Etichetta di stato.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string` | — | Testo badge |
| `tone` | `'default' \| 'success' \| 'warning' \| 'danger'` | `'default'` | Tono colore |

**Stili base:** `borderRadius: 999` (pill), `borderWidth: 1`, `paddingVertical: spacing.xs`, `paddingHorizontal: spacing.sm`. Testo: `typography.caption`, `textTransform: 'uppercase'`, `letterSpacing: 0.5`.

| Tone | bg | text | border |
|---|---|---|---|
| `default` | `navy[50]` (`#F4F5F9`) | `colors.primary` (`#1A1A2E`) | `navy[200]` (`#D6D9E6`) |
| `success` | `#F0FDF4` | `#16A34A` | `#BBF7D0` |
| `warning` | `#FEFCE8` | `#CA8A04` | `#FEF08A` |
| `danger` | `#FEF2F2` | `#DC2626` | `#FECACA` |

---

### 6.5 Input

**File:** `Input.tsx`
**Scopo:** Campo di testo con focus state.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string?` | — | Non renderizzato (passato a TextInput via spread) |
| `...props` | `TextInputProps` | — | Tutte le props native |

**Stili wrapper:**
- Default: `borderRadius: radii.sm`, `borderWidth: 1`, `borderColor: #E2E8F0`, `bg: #F8FAFC`
- Focused: `borderColor: colors.primary` (`#1A1A2E`), `bg: #FFFFFF`

**Stili input:** `typography.body`, `color: colors.textPrimary`, `paddingHorizontal: 18`, `paddingVertical: 14`. Placeholder color: `colors.textMuted`.

---

### 6.6 SelectableChip

**File:** `SelectableChip.tsx`
**Scopo:** Chip toggle con animazione colore.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string` | — | Testo chip |
| `active` | `boolean` | — | Stato attivo |
| `onPress` | `() => void` | — | Handler tap |
| `style` | `ViewStyle?` | — | Override container |
| `textStyle` | `TextStyle?` | — | Override testo |

**Stili:** `borderRadius: 999`, `borderWidth: 1`, `paddingVertical: spacing.sm`, `paddingHorizontal: spacing.md`.

| Stato | bg | border | text |
|---|---|---|---|
| Inattivo | `#F8FAFC` | `#E2E8F0` | `#64748B` |
| Attivo | `#FACC15` | `#FACC15` | `#92400E` |

**Animazione:** `Animated.timing` 180ms su bg, border e text color. Pressed: `opacity: 0.85`.

---

### 6.7 SectionHeader

**File:** `SectionHeader.tsx`
**Scopo:** Titolo sezione con action pill opzionale.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `title` | `string` | — | Titolo sezione |
| `action` | `string?` | — | Testo action pill (opzionale) |
| `subtitle` | `string?` | — | Sottotitolo (opzionale) |
| `hierarchy` | `'primary' \| 'secondary' \| 'tertiary'` | `'secondary'` | Gerarchia visiva |

**Action pill:** `borderRadius: 999`, `borderWidth: 1`, `borderColor: colors.border`, `bg: #FFFFFF`, `paddingHorizontal: spacing.sm`, `paddingVertical: 4`. Testo: `typography.caption` con `textTransform: 'none'`.

---

### 6.8 ToastNotice

**File:** `ToastNotice.tsx`
**Scopo:** Notifica temporanea in overlay.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `message` | `string \| null` | — | `null` per nascondere |
| `tone` | `'success' \| 'info' \| 'danger'` | `'info'` | Tono colore |
| `durationMs` | `number` | `2600` | Durata visibilita |
| `onHide` | `() => void?` | — | Callback dopo scomparsa |

| Tone | bg | text | icon | iconColor | shadowColor |
|---|---|---|---|---|---|
| `success` | `#22C55E` | `#FFFFFF` | `checkmark-circle` | `#FFFFFF` | `#16A34A` |
| `info` | `#1E293B` | `#FFFFFF` | `information-circle` | `#94A3B8` | `#0F172A` |
| `danger` | `#EF4444` | `#FFFFFF` | `alert-circle` | `#FFFFFF` | `#DC2626` |

**Stili toast:** `borderRadius: radii.sm`, `maxWidth: 400`, `width: 100%`, `gap: 12`. Posizione: `top: spacing.sm + insets.top`, centrato, `zIndex: 50`.

**Animazione entrata:** spring `translateY` (-30 → 0), spring `scale` (0.92 → 1), timing `opacity` (0 → 1, 200ms).
**Animazione uscita:** timing 250ms `opacity` → 0, `translateY` → -20, `scale` → 0.95.

---

### 6.9 BottomSheet

**File:** `BottomSheet.tsx` (Android/default) + `BottomSheet.ios.tsx` (iOS)
**Scopo:** Drawer modale dal basso. Usare **solo** per contenuti complessi con scroll.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `visible` | `boolean` | — | Visibilita |
| `onClose` | `() => void` | — | Callback chiusura |
| `onClosed` | `() => void?` | — | Callback post-animazione chiusura |
| `title` | `string?` | — | Titolo header |
| `children` | `ReactNode` | — | Contenuto |
| `footer` | `ReactNode?` | — | Footer fisso in basso |
| `minHeight` | `number?` | 320 (con footer) | Altezza minima |
| `dragEnabled` | `boolean` | `true` | Abilita drag-to-dismiss |
| `closeDisabled` | `boolean` | `false` | Impedisce chiusura |
| `closeOnBackdrop` | `boolean` | `true` | Chiusura su tap backdrop |
| `bottomInsetMode` | `'safe' \| 'none'` | `'safe'` | Gestione safe area bottom |
| `showHandle` | `boolean` | `false` | Mostra handle drag visivo |
| `titleRight` | `ReactNode?` | — | Elemento a destra del titolo |

**Stili sheet:** `borderTopLeftRadius: 24`, `borderTopRightRadius: 24`, `bg: #FFFFFF`, `padding: spacing.lg`.

**Animazione apertura:** backdrop `opacity` timing 180ms, sheet `spring` (damping: 22, stiffness: 240).
**Animazione chiusura:** backdrop `opacity` timing 160ms, sheet `translateY` timing 260ms.
**Drag:** soglia dismiss: `dy > 120 || vy > 0.9`. Over-drag verso l'alto limitato a -8px con fattore 0.2.
**Keyboard:** Offset automatico per tastiera con cap al `topInset`.
**Handle:** barra 40x4px, `bg: #CBD5E1`, `borderRadius: 2`.

---

### 6.10 CalendarDrawer

**File:** `CalendarDrawer.tsx`
**Scopo:** Drawer con calendario mensile per selezione data.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `visible` | `boolean` | — | Visibilita |
| `onClose` | `() => void` | — | Callback chiusura |
| `onSelectDate` | `(date: Date) => void` | — | Callback selezione |
| `selectedDate` | `Date` | — | Data selezionata |
| `maxWeeks` | `number` | `4` | Settimane navigabili nel futuro |
| `caption` | `string \| null` | `'Scegli un giorno...'` | Testo sotto mascotte |

**Layout:** Drawer autonomo (non usa BottomSheet). `borderTopRadius: 28`. Grid 6x7 (42 celle).
**Day cell:** `44x44px`, `borderRadius: 22` (cerchio).

| Stato Day | bg | borderWidth | borderColor | text color | fontWeight |
|---|---|---|---|---|---|
| Default | — | — | — | `#1E293B` | `'600'` |
| Today | — | 2 | `#FACC15` | `#1E293B` | `'700'` |
| Selected | `#1A1A2E` | — | — | `#FFFFFF` | `'700'` |
| Unavailable | — | — | — | `#CBD5E1` | `'600'` |
| Other month | — | — | — | `#E2E8F0` | `'600'` |

**Navigazione mese:** frecce circolari 36x36, `borderRadius: 18`, `borderWidth: 1`, `borderColor: #E5E7EB`. Label mese: `fontSize: 18`, `fontWeight: '700'`.
**Weekday headers:** `fontSize: 11`, `fontWeight: '700'`, `color: #94A3B8`, uppercase.
**Mascotte:** immagine `duck-calendar.png` (120x85px) con caption e hint.

---

### 6.11 MiniCalendar

**File:** `MiniCalendar.tsx`
**Scopo:** Calendario inline (non drawer) per schermate gestione.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `selectedDate` | `string \| null` | — | Formato `YYYY-MM-DD` |
| `onSelectDate` | `(date: string) => void` | — | Callback con `YYYY-MM-DD` |
| `markedDates` | `Set<string>?` | — | Date con dot indicatore |
| `maxWeeks` | `number` | `12` | Settimane navigabili |

**Day cell:** `40x40px`, `borderRadius: 20`. Day text: `fontSize: 14`.
**Selezionato:** `bg: #1A1A2E` (navy), testo bianco. **Today:** border 2 `#1A1A2E`. **`selectedToday`:** fill navy (la selezione domina). No giallo.
**Marked dot:** cerchio `5x5px`, `bg: #1A1A2E`, posizione `absolute bottom: 4`.
**Fade transition:** `Animated.timing` 220ms su opacity al cambio mese.
**LayoutAnimation:** attivato su Android per transizioni mese (`easeInEaseOut`).

---

### 6.12 TimePickerDrawer

**File:** `TimePickerDrawer.tsx`
**Scopo:** Drawer per selezione orario con scroll colonne.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `visible` | `boolean` | — | Visibilita |
| `onClose` | `() => void` | — | Callback chiusura |
| `onSelectTime` | `(date: Date) => void` | — | Callback con data+orario |
| `selectedTime` | `Date` | — | Orario selezionato |

**Layout:** Usa `BottomSheet` con `showHandle` e `footer` (CTA conferma).
**Colonne:** 2 ScrollView affiancate (Ore 0-23, Minuti 0/15/30/45). Item height: `48px`, column height: `250px`.
**Item selezionato:** `bg: #FACC15`, `fontWeight: '700'`, `color: #92400E`.
**Item non selezionato:** `color: #64748B`, `fontWeight: '500'`.
**Label colonne:** `fontSize: 12`, `fontWeight: '700'`, `color: #94A3B8`, uppercase.
**CTA footer:** `bg: #1A1A2E`, `borderRadius: radii.sm`, `minHeight: 52`, ombra navy.
**Mascotte:** `duck-clock.png` (100x73px).
**Auto-scroll:** scroll al valore selezionato al mount con `setTimeout` 100ms.

---

### 6.13 RangesEditor

**File:** `RangesEditor.tsx`
**Scopo:** Editor fasce orarie con add/remove.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `ranges` | `TimeRange[]` | — | `{ startMinutes, endMinutes }` |
| `onChange` | `(ranges) => void` | — | Callback modifica |
| `onPickTime` | `(index, field) => void` | — | Callback tap su orario |
| `onAddRange` | `() => void` | — | Callback aggiungi fascia |
| `disabled` | `boolean` | `false` | Stato disabilitato |

**Row:** `borderRadius: 999`, `bg: #FFFFFF`, `paddingVertical: 14`. Ombra leggera (`shadowOpacity: 0.05`).
**Clock icon circle:** `36x36`, `borderRadius: 18`, `bg: #EEF0F4` (navy tint), icona `time` color `#1A1A2E`.
**Time text:** `fontSize: 16`, `fontWeight: '600'`, `color: #1E293B`, `textDecorationLine: 'underline'`, underline color `#E2E8F0`.
**Add button:** `borderRadius: 999`, `borderWidth: 1.5`, `borderStyle: 'dashed'`, `borderColor: #CBD5E1`. Testo `fontSize: 14`, `color: #64748B`.
**Animazioni:** `FadeIn.duration(200)` / `FadeOut.duration(150)` (react-native-reanimated).

---

### 6.14 SearchableSelect

**File:** `SearchableSelect.tsx`
**Scopo:** Input con dropdown suggerimenti filtrati.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string?` | — | Label sopra il campo |
| `placeholder` | `string?` | — | Placeholder input |
| `value` | `string \| null` | — | Valore selezionato |
| `options` | `SearchableSelectOption[]` | — | `{ value, label, subtitle? }` |
| `onChange` | `(value) => void` | — | Callback selezione |
| `onFocus` | `() => void?` | — | Callback focus |
| `disabled` | `boolean` | `false` | Stato disabilitato |
| `emptyText` | `string` | `'Nessun risultato.'` | Testo lista vuota |
| `maxSuggestions` | `number` | `8` | Massimo suggerimenti |
| `persistSelectedLabel` | `boolean` | `true` | Mantieni label nel campo |

**Input wrapper:** come `Input` (`borderRadius: radii.sm`, bordo `#E2E8F0` / focus `colors.primary`), con icona search (`Ionicons search`, 20px, `#94A3B8`).
**Dropdown:** `position: absolute`, `top: 100%`, `marginTop: spacing.xs`, `borderRadius: radii.sm`, `bg: #FFFFFF`, `maxHeight: 220`, `zIndex: 200`.
**Option selezionata:** `bg: navy[50]`. **Option pressed:** `opacity: 0.72`.
**Animazione apertura:** timing 180ms `opacity` + `translateY` (-6 → 0) + `scale` (0.98 → 1).

---

### 6.15 CalendarNavigator

**File:** `CalendarNavigator.tsx`
**Scopo:** Navigazione temporale con chip Giorno/Settimana/Mese/Oggi.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `initialMode` | `'day' \| 'week' \| 'month'` | `'week'` | Modalita iniziale |
| `initialDate` | `Date?` | `new Date()` | Data iniziale |
| `onChange` | `(range) => void` | — | Callback con `CalendarNavigatorRange` |
| `style` | `ViewStyle?` | — | Override container |

**Frecce:** circle `34x34`, `borderRadius: 17`, `borderWidth: 1`, `borderColor: colors.border`, `bg: #FFFFFF`. Pressed: `opacity: 0.72`.
**Range label:** `typography.body` con `fontWeight: '700'`, `textTransform: 'capitalize'`, centrato.
**Mode chips:** row di `SelectableChip` con `gap: spacing.xs`.

---

### 6.16 Skeleton

**File:** `Skeleton.tsx`
**Scopo:** Placeholder loading animato.

**SkeletonBlock:**

| Prop | Tipo | Default |
|---|---|---|
| `width` | `number \| string` | `'100%'` |
| `height` | `number` | `14` |
| `radius` | `number` | `10` |
| `style` | `ViewStyle?` | — |

`bg: rgba(0,0,0,0.06)`. Animazione pulse: `opacity` 0.42 ↔ 0.9, durata 760ms ciascuna direzione, `Easing.inOut(quad)`, loop infinito.

**SkeletonCard:** `borderRadius: radii.lg`, `bg: #F8FAFC`, `padding: 16`, `gap: 10`.

---

### 6.17 BookingCelebration

**File:** `BookingCelebration.tsx`
**Scopo:** Overlay animato per conferma prenotazione.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `visible` | `boolean` | — | Attiva animazione |
| `onHidden` | `() => void?` | — | Callback fine animazione |

**Durata totale:** ~1550ms (1450ms animazione + 100ms hold).
**Elementi:** backdrop fade, ring espansione (`navy[200]`), 5 sparkle burst (`colors.primary`), card centrale con checkmark.
**Card:** `minWidth: 248`, `borderRadius: 22`, `bg: #FFFFFF`. Icona: `checkmark-circle` 46px `colors.positive` in cerchio 66px con `bg: rgba(34,197,94,0.12)`, `border: rgba(34,197,94,0.35)`.
**Testo:** "Prenotazione confermata", `typography.subtitle`.

---

### 6.18 ScrollHintFab

**File:** `ScrollHintFab.tsx`
**Scopo:** FAB flottante per indicare contenuto scrollabile.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `direction` | `'up' \| 'down'` | — | Direzione freccia |
| `onPress` | `() => void` | — | Handler tap |
| `style` | `ViewStyle?` | — | Override posizione |

**Bottone:** circle `38x38`, `borderRadius: 19`, `borderWidth: 1`, `borderColor: colors.border`, `bg: #FFFFFF`. Icona `chevron-down` 19px (ruotata 180deg per `up`).
**Animazione float:** loop spring `translateY` ±7px con delay e bounce.
**Pressed:** `scale: 0.96`.

---

### 6.19 AppTabBar (era GlassTabBar)

> **Reattività (28/10/2026):** la voce toccata si accende già al tocco (`onPressIn` → stato locale `pressedKey`), senza aspettare che la navigazione renderizzi la schermata nuova; si riallinea a `state.index` appena la navigazione è avvenuta, o si spegne se il tocco è annullato.

> **REG-639 (28/10/2026): la tab bar NON è clay — vale la «T1 piatta» qui sotto.** La capsula bianca in rilievo con icone 3D e bolla sulla voce attiva è stata provata sul simulatore e bocciata da Tiziano («sembra la versione finta di quella nativa Apple»); il file è tornato identico a REG-638. Non riproporla.
>
> **28/10/2026 sera (giro Road, «B · vetro a tutta larghezza» scelta da Tiziano, iOS e Android):** la barra sta SOPRA le schermate (`position: absolute`). iOS: `BlurView` `systemChromeMaterialLight` + velo bianco 0.55; Android: bianco 0.96 senza blur. Filo in alto quasi invisibile (0.08), glifi 26, grigio `#9A9A9F`. Le quattro radici dell'istruttore (Agenda, Road, Allievi, Tu) scorrono sotto il vetro e si tengono in fondo lo spazio con `useTabBarOverlap()` (`src/components/tabBarSpace.ts`); ogni altra schermata ha lo spazio riservato da `sceneStyle` in `app/(tabs)/_layout.tsx` (lista `FULL_PAGES`: una pagina a schermo pieno nuova in quelle pile va aggiunta lì). Il «+» dell'Agenda sale sopra la barra. Tab Road all'avvio: vale l'ultimo stato noto (impostazioni persistite) finché `/road/state` non risponde; senza cache il velo di caricamento di `AuthGate` aspetta le impostazioni (max 1,5 s) e sparisce in dissolvenza; le voci che cambiano dopo scivolano (220 ms).
>
> **28/10/2026 (REG-638, «T1 piatta» scelta da Tiziano):** `src/components/AppTabBar.tsx`, un solo file. Barra **bianca piatta** con filo sottile in alto, niente vetro, niente ombre, niente cerchio in rilievo, niente pillole. Glifi monocromatici in stile SF Symbols: contorno grigio `#8E8E93` a riposo, pieno nero `#111111` sulla voce attiva, etichetta 10.5 sotto. **Istruttore e titolare-istruttore** (`useInstructorTabs`): **Agenda · Road · Allievi · Tu** (`calendar`, `map`, `people`, `person-circle`); Road solo con Road acceso. Disponibilità e Notifiche escono dalla barra: orologio e campanella (cerchi bianchi con ombra morbida, `InboxBellButton.tsx`) nell'intestazione dell'Agenda; la campanella anche nella tab Road. Il testo sotto è storico.

**File:** `GlassTabBar.tsx` (Android) + `GlassTabBar.ios.tsx` (iOS)
**Scopo:** Tab bar personalizzata.

- **iOS:** usa token deprecati `glass*` + `BlurView` nativo per effetto vetro.
- **Android:** tab bar custom con `bg: #FFFFFF`, highlight navy.

### 6.20 Agenda istruttore / titolare (clay v2, REG-639)

Feature doc completo: [features/agenda-istruttore.md](features/agenda-istruttore.md).
Schermata: `IstruttoreHomeScreen` (anche `TitolareHomeScreen` = `ownerMode`).
**Una sola vista: la Settimana** (griglia `WeeklyAgendaView`), come dopo
REG-638. La vista Giorno a lista provata la notte del 28/10 è stata bocciata
da Tiziano il 29/10 ed eliminata.

- **Testata**: titolo «Agenda» 32/600 + data di oggi in grigio; a destra
  orologio (Disponibilità) e campanella (`InboxBellButton`), cerchi bianchi
  clay, solo nell'app istruttore. Il titolare-istruttore ha sotto due voci di
  testo «Le mie guide» / «Tutti gli istruttori» (niente chip). Il banner «N guide
  fuori disponibilità» è una `ClaySurface` piccola con «Gestisci» + chevron,
  senza icona. Niente segmentato.
- **Griglia**: colonne **bianche** divise da un filetto (niente grigio), nomi
  dei giorni in minuscolo (`lun`, `mar`…), oggi nel cerchio nero, festivi
  grigi barrati, disponibilità come **tinta appena accennata**
  (`rgba(17,17,17,0.028)`), linea dell'ora nera, «Oggi» come link testuale.
  L'intestazione dei giorni non è tappabile.
- **Blocchi delle guide = riempimento pastello pieno**: fondo pieno nella tinta
  scelta dall'autoscuola (ammorbidita da `softenTint`), **niente bordo, niente
  barretta**, solo un'**ombra morbida nella stessa tinta**, testo scuro
  leggibile. Un solo punto: `src/utils/agendaLook.ts` (`AGENDA_BLOCK_BAR =
  false` in `agendaColors.ts`; la barretta su bianco è stata bocciata). Il
  bordo del cambio automatico (REG-622) resta, è un'impostazione di prodotto.
  Esami: bianco con ombra neutra (niente viola); gruppi: verde foglia pastello,
  gruppi moto: ambra pastello; annullata/assente: grigio tenue; esame il giorno
  dopo: rosso pastello. Blocchi istruttore (pausa, blocco, malattia, ferie):
  bianchi tratteggiati in grigio, senza icona; la pausa tra guide si legge
  «Pausa». Dettagli in [features/agenda-block-colors.md](features/agenda-block-colors.md).
- **Colori = «Aspetto agenda»**: i blocchi usano **esattamente il colore scelto in «Aspetto agenda»** dall'autoscuola (anche blu/azzurro), a fondo pastello pieno — decisione di Tiziano del 29/10 («i colori devono rispettare i setting Aspetto agenda»). La regola `NEUTRAL_BLUE` provata la notte del 28/10 è stata eliminata.
- **FAB «+»**: cerchio nero 56 col volume della CTA primaria
  (`CLAY_CTA.primary`). Apre il foglio **«Nuovo»** (`home/add-action`,
  FORM_SHEET + `<FormSheet>`): `ClayList` di solo testo (Guida, Guida di
  gruppo, Esame, Lezione teorica, Blocca un orario, Malattia), titolo + una
  riga che spiega, **niente icone**.

---

## 7. Pattern UI

### 7.1 Modali Centrate

Per azioni rapide (proposte, conferme, form brevi). **Preferire sempre rispetto a BottomSheet** per interazioni semplici.

```tsx
<Modal transparent animationType="fade" visible={open} onRequestClose={close}>
  <View style={styles.modalOverlay}>
    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
    <View style={styles.modalCard}>
      {/* contenuto */}
    </View>
  </View>
</Modal>
```

**Stili:**
- `modalOverlay`: `flex: 1`, `justifyContent: 'center'`, `alignItems: 'center'`, `backgroundColor: rgba(0,0,0,0.35)`
- `modalCard`: `bg: #FFFFFF`, `borderRadius: 24`, `padding: 24`, `gap: 16`, ombra forte (§5.8)
- Info card interna: `bg: #FEF9C3`, `border: #FDE68A`, `borderRadius: 16`
- Azione distruttiva testo: `color: #EF4444`, bold, centrato

### 7.2 Card "Prossima Guida" (Gradient Giallo)

```tsx
<View style={styles.nextLessonShadow}>
  <LinearGradient
    colors={['#FACC15', '#FDE68A']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0.8, y: 1 }}
    style={styles.nextLessonCard}
  >
    {/* contenuto */}
  </LinearGradient>
</View>
```

Il wrapper esterno porta l'ombra ambra (§5.5), il gradient interno ha `overflow: 'hidden'` e `borderRadius: radii.lg`.

### 7.3 CTA Hero (Bottone Grande Navy)

`Pressable` custom (non il componente `Button`) con `minHeight: 58`, `fontSize: 18`, `fontWeight: '700'`, `borderRadius: radii.sm`, ombra navy (§5.4). **Pressed:** `scale: 0.98`, `opacity: 0.85`.

### 7.4 Mascotte (Duck)

Pattern ricorrente nei drawer:
- `duck-calendar.png` in CalendarDrawer (120x85px)
- `duck-clock.png` in TimePickerDrawer (100x73px)
- Posizionata in sezione centrata con caption e hint text sotto

### 7.5 Form a Card — Gerarchia Input (3D primario vs Lista secondario)

Pattern di riferimento: **`app/(tabs)/home/new-booking.tsx`** ("Nuova prenotazione", rifatta 2026-06-08) + **`manage-lesson.tsx`** ("Gestisci guida"). Regola: la **gerarchia visiva comunica la priorità del dato**. Niente bordi sui campi — solo superfici bianche + ombra, oppure righe piatte.

**Titolo pagina** = hero (vedi §12.7), **senza divider sotto**.

**① Input PRIMARI → righe in card bianca elevata (3D, NO bordi).** Per i dati più importanti (es. allievo, giorno, ora, durata).
```tsx
// card group
group: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, marginBottom: 14,
  shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 }
// riga dentro la card: icona outline (26w) + label + valore + chevron
row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 64 }
rowLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' }   // nome campo
rowValue: { fontSize: 14, color: '#717171' }                     // selezione corrente
rowPlaceholder: { fontSize: 14, color: '#94A3B8' }               // quando vuoto
divider: { height: hairline, backgroundColor: '#EFF0F3' }        // SOLO tra righe interne
chevron: 'chevron-forward' 18 '#C7CBD1'
```
Più righe correlate possono stare nella stessa card (es. Giorno + Ora + Durata). L'allievo usa un **avatar a iniziali** (44, `backgroundColor: N100`) al posto dell'icona.

**② Input SECONDARI → righe piatte a lista (NO card, NO ombra).** Per i dati meno prioritari (es. luogo, veicolo, tipo). Stesso markup `row` ma su sfondo trasparente, preceduti da una caption.
```tsx
listCaption: { fontSize: 12, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.4,
  textTransform: 'uppercase', marginLeft: 6 }   // es. "DETTAGLI"
list: { paddingHorizontal: 6 }                   // righe + divider tra loro, niente superficie
```

**③ Opzioni OPTIONAL → banner tinto leggero (NO ombra).** Per un extra non necessario (es. "Prenotazione multipla"): si distingue dalle card bianche, legge come secondario.
```tsx
optBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F4F5F9',
  borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14 }   // N50, flat
optIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF' }  // icona in cerchio bianco
```

**④ CTA footer** = riepilogo a sinistra (label muted + valore navy, la durata va a capo se la riga è lunga) + `Button tone="primary"` a destra. **In loading mostra lo spinner, NON cambia label** (`<Button loading={pending} .../>`, vedi §6.3).

Sintesi gerarchia: **card 3D bianca = primario · lista piatta = secondario · banner tinto = optional**.

### 7.6 Picker via Form Sheet Nativa (store seed-and-callback)

Ogni sotto-input di un form NON si apre inline ma in una **route nativa** (Expo Router), seminata via store + callback. Pattern: il parent fa `store.set({ ...dati, onConfirm/onSelect })` poi `router.push('/(tabs)/home/<route>')`; la route legge lo store con `useSyncExternalStore`, e su conferma chiama la callback e fa `router.back()`. Vedi [[reference_native_formsheet]].

| Cosa | Route | Store | Presentazione |
|------|-------|-------|--------------|
| Data (calendario mesi) | `select-date` | `dayPickerStore` | `modal` |
| Ora (ruota) | `time-picker` | `timePickerStore` | `formSheet` + `fitToContents` |
| Allievo (ricerca + lista, single) | `select-student` | `studentPickerStore` | `modal` |
| Allievi (ricerca + checkbox, MULTI) | `select-exam-students` | `examStudentsStore` | `modal` |
| Durata / Veicolo / Tipo / Aggiungi allievo | `select-options` (≤7 voci) / `select-options-long` (>7, scrollabile) — route scelta da `optionsPickerPath()` DOPO `optionsPickerStore.set()` | `optionsPickerStore` | `formSheet fitToContents` / `modal` (2026-07-07: il form sheet clippava le liste lunghe senza scroll) |

**Ricerca nel picker lungo (REG-617, 14/10/2026).** Oltre `PICKER_SEARCH_THRESHOLD` (**8**) voci il
foglio che scorre si porta dietro un campo di ricerca, da solo: `shouldShowPickerSearch(count,
scrollable)`. Due confini voluti:

- **Solo nella variante `scrollable`.** In un `fitToContents` il filtro cambierebbe l'altezza del
  foglio a ogni lettera, e quel foglio non si rimisura (§13.2.1).
- **Solo sopra la soglia.** Su una lista corta la ricerca è un ingombro che allontana la prima
  riga dal pollice; oltre, è il contrario — scorrere 256 allievi a mano non è una risposta.

Il campo è lo stesso di `select-student` (card bianca, bordo `#ECECEC`, radius 16, icona `search`
a sinistra, `clearButtonMode="while-editing"`): coerenza prima di originalità. La `ScrollView`
vuole `keyboardShouldPersistTaps="handled"`, altrimenti con la tastiera aperta il primo tocco su
una riga serve solo a chiuderla. Il confronto sta in `src/utils/peopleSearch.ts` — **senza accenti
né maiuscole, e a parole**: "rossi mario" trova "Mario Rossi". Lo stato vuoto lo decide chi apre
il picker (`emptyLabel`, default "Nessun risultato"), perché il foglio è condiviso: nel caso degli
allievi è "Nessun allievo trovato".
| Luogo (+ crea) | `manage-lesson-location` (+ `-location-form`) | `locationPickerStore` (+ `locationFormStore`) | `formSheet` + `fitToContents` |
| Impostazioni allievo (gruppo, pronto esame, luogo) | `student-settings` | `studentSettingsStore` | `formSheet` + `fitToContents` |

**Non solo picker — anche i CONTROLLI possono uscire dalla pagina.** Nella scheda allievo le tre
righe di impostazione stavano sempre aperte e la riempivano: ora sono una riga sola con le chip
di stato (`Gruppo` · `Pronto esame` · `Sede`, in navy quando attive) e il chevron, e i controlli
veri vivono nel form sheet. Lo stato resta leggibile senza aprire nulla, che era l'unica cosa che
quelle righe davano in cambio dello spazio occupato. Gli handler (chiamate API, toast, rollback)
restano nella schermata: il foglio disegna soltanto.

`OptionsPickerData` accetta anche `hint` (riga di servizio sotto il titolo), `confirmLabel`
(etichetta della CTA multipla) e `subtitle` per opzione. Per le misure interne dello sheet
(respiro, CTA ancorata in fondo) vedi §13.2.1.

Ogni foglio, anche con liste lunghe, è un **form sheet alto quanto il contenuto che scorre da sé** (regola Reglo, §13.2.1). Il **page sheet non si usa più per le liste lunghe**: quelli che ci sono ancora (`select-options-long`, `select-student`, …) vanno portati alla regola quando si toccano.

> **Corollario, costato un rilascio rotto il 23/09/2026 (REG-510).** In un form `SCROLL_SHEET` ci deve essere **un solo contenitore scrollabile**: quello dello `SheetScaffold`. Mettere accanto a lui un'altra `ScrollView` — anche solo **orizzontale**, come una barra filtri — li fa competere per l'altezza dentro la colonna flex: quella orizzontale collassa e il suo contenuto trabocca sopra l'header e la X. Titolo, filtri e lista vanno **dentro** lo scaffold e scorrono insieme, com'è in `StudentPaymentsScreen`.

> **Tastiera nei fogli (REG-664, 30/10/2026).** Lo scroll di `FormSheet` ha `automaticallyAdjustKeyboardInsets` (iOS: si accorcia dell'area coperta dalla tastiera e porta in vista il campo con il focus) e `keyboardDismissMode="interactive"` (scorrere NON chiude la tastiera; la si trascina giù col dito). Su Android il foglio aggiunge in fondo uno spazio alto quanto la tastiera. Vale per ogni campo in ogni `FormSheet`: niente `KeyboardAvoidingView` o `keyboardDismissMode="on-drag"` nei singoli fogli, e niente `react-native-keyboard-controller` (modulo nativo: con un OTA farebbe crashare la 2.4.0).

---

## 8. Animazioni

> **Prima di tutto §15 «Fluidità e prestazioni»** (29/10/2026): niente layout transitions né entrate dal basso su contenitori con ombre, il tocco anima prima del contenuto. Dove questa sezione dice altro, vince §15.

> **Filosofia: L'app deve sentirsi viva.**
> Ogni transizione di stato, ogni interazione, ogni cambiamento di contenuto deve avere un'animazione.
> L'assenza di animazione e un bug visivo.
> L'obiettivo e un'app che respira — fluida, reattiva, con personalita.

> **Carattere (Tiziano, 27/10/2026): sobrio e morbido, NIENTE rimbalzi.**
> Nulla compare o sparisce di botto (entering/exiting + layout transition su
> stati, card, righe, banner), ma senza overshoot visibile: timing con easing
> che decelera, oppure spring molto smorzate con `overshootClamping`. Le curve
> «Bouncy» ed «Elastic» qui sotto non si usano nel codice nuovo. Preset pronti:
> `src/road/motion.ts` (`ROAD_LAYOUT`, `roadEnter`, `roadStagger`, `ROAD_EXIT`,
> `ROAD_TEXT_IN/OUT`, `ROAD_SPRING`) e `RoadPressable` per la scala al tocco.
> Sempre `.reduceMotion(ReduceMotion.Never)`: il default di Reanimated spegne le
> layout animation con «Riduci movimento», e da noi non deve succedere.

### 8.1 Libreria e Gerarchia

| Libreria | Quando usarla | Note |
|---|---|---|
| **`react-native-reanimated`** | **Preferita per tutto il nuovo codice.** Shared values, `useAnimatedStyle`, `withSpring`, `withTiming`, entering/exiting layout transitions, gesture handler. | Gira sul UI thread — sempre 60fps. |
| **`Animated` (RN core)** | Codice esistente (BottomSheet, ToastNotice, BookingCelebration, SelectableChip, Skeleton, ScrollHintFab, MiniCalendar, SearchableSelect). Accettabile per animazioni semplici. | Migrare gradualmente a reanimated. |
| **`LayoutAnimation`** | Transizioni di layout one-shot (aggiunta/rimozione elementi, cambio altezza). | Abilitare su Android: `UIManager.setLayoutAnimationEnabledExperimental(true)`. |

**Regola:** per ogni nuovo componente o nuova animazione, usare `react-native-reanimated`. Non aggiungere nuovo codice con `Animated` core.

### 8.2 Curve di Easing — Reference

| Nome | Config | Carattere | Quando usare |
|---|---|---|---|
| **Snappy** | `withSpring({ damping: 20, stiffness: 300 })` | Scatto deciso, poco rimbalzo | Press feedback, toggle, chip |
| **Bouncy** | `withSpring({ damping: 12, stiffness: 200 })` | Rimbalzo morbido, giocoso | Celebrazioni, entrata elementi, FAB |
| **Gentle** | `withSpring({ damping: 22, stiffness: 240 })` | Fluido, nessun rimbalzo | Drawer apertura, sheet slide-in |
| **Swift** | `withTiming(value, { duration: 200, easing: Easing.out(Easing.cubic) })` | Veloce, decelerazione naturale | Fade, color change, scale |
| **Slow reveal** | `withTiming(value, { duration: 400, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })` | Elegante, graduale | Entrata contenuto pagina, skeleton → contenuto |
| **Elastic** | `withSpring({ damping: 8, stiffness: 150 })` | Rimbalzo forte, playful | Successo, badge counter, notifiche importanti |

### 8.3 Scala Durate

| Categoria | Durata | Esempi |
|---|---|---|
| **Micro** | 80–150ms | Press scale, color change, opacity toggle |
| **Standard** | 150–300ms | Fade in/out, slide, chip toggle, dropdown |
| **Enfasi** | 300–500ms | Entrata card, stagger list items, drawer open |
| **Drammatica** | 500–1500ms | Celebrazione, onboarding, prima apparizione |

**Regola:** se un'animazione non rientra in queste fasce, probabilmente e troppo lenta o troppo veloce.

### 8.4 Pattern Obbligatori — Micro-interazioni

Ogni elemento interattivo **deve** avere feedback tattile animato:

#### Press Feedback (OBBLIGATORIO su ogni Pressable/TouchableOpacity)

```ts
// Standard — per bottoni, card, chip
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed.value ? 0.97 : 1, { damping: 20, stiffness: 300 }) }],
}));

// Leggero — per elementi piccoli (icon button, day cell, option row)
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed.value ? 0.92 : 1, { damping: 15, stiffness: 200 }) }],
}));

// CTA Hero — per azioni principali
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, { damping: 20, stiffness: 280 }) }],
  opacity: withTiming(pressed.value ? 0.88 : 1, { duration: 100 }),
}));
```

**Nessun elemento tappabile deve avere transizione solo `opacity` senza `scale`.** L'utente deve sempre percepire che "sta premendo qualcosa di fisico".

#### Toggle / Switch State

```ts
// Cambio stato (attivo/inattivo, selezionato/deselezionato)
backgroundColor: withTiming(active ? ACTIVE_COLOR : INACTIVE_COLOR, { duration: 180 }),
borderColor: withTiming(active ? ACTIVE_BORDER : INACTIVE_BORDER, { duration: 180 }),
```

Usato da: SelectableChip, day cell calendario, filtri. **Sempre animare** bg + border + text color insieme.

### 8.5 Pattern Obbligatori — Entrata Contenuto

#### Fade + Slide Up (Standard per contenuto che appare)

```ts
// Singolo elemento
entering={FadeIn.duration(300).delay(delay)}
// oppure
entering={FadeInDown.duration(350).springify().damping(18)}
```

#### Stagger List (OBBLIGATORIO per liste e griglie)

Ogni lista di card, righe agenda, slot disponibili **deve** avere entrata staggerata:

```ts
// Ogni item riceve un delay incrementale
const STAGGER_DELAY = 50; // ms tra ogni item

// Per item index i:
entering={FadeInDown.duration(350).delay(i * STAGGER_DELAY).springify().damping(18)}
```

| Contesto | Delay base | Delay stagger | Animazione |
|---|---|---|---|
| Card lista (home, agenda) | 0ms | 60ms per item | `FadeInDown` + spring |
| Slot disponibili booking | 100ms | 40ms per item | `FadeIn` + `scale` 0.95→1 |
| Righe tabella/gestione | 0ms | 50ms per item | `FadeInRight` |
| Badge / chip row | 0ms | 30ms per item | `FadeIn` + `scale` 0.9→1 |

**Massimo stagger:** cappare a ~8 item (400ms totali). Oltre, tutto appare insieme.

#### Skeleton → Contenuto

Quando il dato arriva e lo skeleton viene sostituito dal contenuto reale:

```ts
// Skeleton: gia presente con pulse
// Contenuto: entra con fade + leggero scale-up
entering={FadeIn.duration(400)}
// oppure per piu impatto:
entering={FadeIn.duration(300).springify()}
```

**Non** fare apparire il contenuto senza transizione dopo uno skeleton — e un salto visivo fastidioso.

### 8.6 Pattern Obbligatori — Transizioni di Stato

#### Cambio Numerico (Counter / Badge Count)

Quando un numero cambia (es. contatore lezioni, importo, badge):

```ts
// Scale bounce sul cambio
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(1, { damping: 8, stiffness: 200 }) }],
}));
// Trigger: setValue(0.85) poi lasciare lo spring tornare a 1
```

#### Empty State → Contenuto (e viceversa)

```ts
// Empty state esce
exiting={FadeOut.duration(200)}
// Contenuto entra
entering={FadeIn.duration(300).delay(150)}
```

#### Stato Successo / Errore

Dopo un'azione (prenotazione, pagamento, errore):

| Stato | Animazione | Durata |
|---|---|---|
| Successo | `BookingCelebration` pattern (sparkle + scale) | 1450ms |
| Successo leggero | Checkmark icon `FadeIn` + `scale` bounce | 400ms |
| Errore | Shake orizzontale (3 oscillazioni) | 300ms |
| Warning | Pulse opacity (2 cicli) | 600ms |

```ts
// Shake per errore
const shake = useSharedValue(0);
shake.value = withSequence(
  withTiming(-8, { duration: 50 }),
  withTiming(8, { duration: 50 }),
  withTiming(-6, { duration: 50 }),
  withTiming(6, { duration: 50 }),
  withTiming(0, { duration: 50 }),
);
```

### 8.7 Pattern Obbligatori — Drawer e Modal

#### Drawer (BottomSheet / CalendarDrawer)

| Fase | Animazione | Config |
|---|---|---|
| Apertura backdrop | `opacity` timing | 180ms |
| Apertura sheet | `translateY` spring | Gentle: damping 22, stiffness 240 |
| Chiusura backdrop | `opacity` timing | 160ms |
| Chiusura sheet | `translateY` timing | 260ms |
| Drag snap-back | `translateY` spring | stiffness 220, damping 18 |
| Dismiss threshold | — | `dy > 120 \|\| vy > 0.9` |
| Over-drag up | clamped | max -8px, fattore 0.2 |

#### Modal Centrata

```ts
// Entrata: scale + fade combinati
entering: FadeIn.duration(200)
// Card interna: spring scale
cardScale: withSpring(1, { damping: 18, stiffness: 260 }) // da 0.92
cardOpacity: withTiming(1, { duration: 200 })

// Uscita: fade rapido
exiting: FadeOut.duration(150)
cardScale: withTiming(0.95, { duration: 150 })
```

### 8.8 Pattern Obbligatori — Scroll e Navigazione

#### Scroll-Driven Header (Parallax Leggero)

Per schermate con header grande (home):

```ts
// Header title: fade + translateY basato su scrollY
const titleOpacity = interpolate(scrollY.value, [0, 80], [1, 0], 'clamp');
const titleTranslateY = interpolate(scrollY.value, [0, 80], [0, -20], 'clamp');
```

#### Tab Switch

Al cambio tab, il contenuto della nuova tab deve entrare con:

```ts
// Cross-fade: vecchio tab esce, nuovo entra
entering={FadeIn.duration(200)}
exiting={FadeOut.duration(150)}
```

#### Pull-to-Refresh

Animazione custom per il pull-to-refresh (non il default di sistema):
- Icona o mascotte duck che ruota/rimbalza durante il pull
- Spring snap-back al rilascio

#### Navigazione Calendario (Mese Avanti/Indietro)

```ts
// Slide orizzontale + fade
// Avanti: contenuto esce a sinistra, nuovo entra da destra
// Indietro: contenuto esce a destra, nuovo entra da sinistra
// Con cross-fade opacity
duration: 250ms
easing: Easing.out(Easing.cubic)
```

### 8.9 Pattern Obbligatori — Apparizioni e Notifiche

#### Toast Entrata/Uscita

| Fase | Proprieta | Config |
|---|---|---|
| Entrata | `translateY` | spring: damping 18, stiffness 300 (da -30 a 0) |
| Entrata | `scale` | spring: damping 16, stiffness 280 (da 0.92 a 1) |
| Entrata | `opacity` | timing 200ms (0 → 1) |
| Uscita | `opacity` | timing 250ms (1 → 0) |
| Uscita | `translateY` | timing 250ms (0 → -20) |
| Uscita | `scale` | timing 250ms (1 → 0.95) |

#### FAB / Floating Action Button

```ts
// Entrata: scale da 0 con bounce
entering={ZoomIn.springify().damping(12)}
// Uscita:
exiting={ZoomOut.duration(200)}
// Idle: floating loop (come ScrollHintFab)
translateY: loop spring ±7px
```

### 8.10 Pattern Obbligatori — Loading e Progress

#### Skeleton Pulse (Esistente)

```ts
opacity: loop(
  sequence(
    timing(0.9, { duration: 760, easing: Easing.inOut(Easing.quad) }),
    timing(0.42, { duration: 760, easing: Easing.inOut(Easing.quad) }),
  )
)
```

#### Spinner / Activity Indicator

Se serve un loading puntuale (non skeleton), usare un cerchio che ruota con:
- Colore: `colors.primary` (#1A1A2E)
- Size: 24px (inline), 40px (centrato in pagina)
- Animazione: rotazione continua `withRepeat(withTiming(360deg, { duration: 800 }), -1)`

#### Progress Bar Animata

Per azioni con progresso (upload, pagamento in corso):
```ts
width: withTiming(`${progress}%`, { duration: 300, easing: Easing.out(Easing.cubic) })
// Colore: gradient da colors.accent a colors.primary
```

### 8.11 Pattern Consigliati — Delight

Animazioni non obbligatorie ma che aggiungono personalita:

#### Confetti / Sparkle

Dopo un pagamento completato o un traguardo raggiunto. Pattern come `BookingCelebration` ma con variazioni:
- Particelle piu piccole e colorate (navy + giallo + verde)
- Burst radiale piu ampio
- Durata: 1200–1800ms

#### Mascotte Animata

Le immagini duck possono avere micro-animazioni:
- Leggero `rotate` oscillante (±3deg, loop lento 2s)
- Bounce `translateY` ±4px al mount

#### Haptic Feedback

Abbinare animazioni visive con feedback tattile (via `expo-haptics`):

| Azione | Haptic | Animazione visiva |
|---|---|---|
| Tap bottone | `impactAsync(Light)` | Scale spring |
| Prenotazione confermata | `notificationAsync(Success)` | BookingCelebration |
| Errore form | `notificationAsync(Error)` | Shake |
| Toggle chip | `selectionAsync()` | Color transition |
| Drag-to-dismiss release | `impactAsync(Medium)` | Spring snap |

### 8.12 Checklist Animazione per Nuovo Componente

Prima di considerare un componente "finito", verificare:

- [ ] **Press feedback**: ogni `Pressable` ha `scale` spring (0.92–0.98)
- [ ] **Entrata**: il componente ha un'animazione di mount (`entering` o manuale)
- [ ] **Stato toggle**: se ha stati, la transizione e animata (colore, scale, o entrambi)
- [ ] **Lista**: se renderizza N item, ha stagger delay
- [ ] **Loading**: se ha stato loading, usa Skeleton con transizione a contenuto reale
- [ ] **Uscita**: se puo essere rimosso, ha `exiting` (FadeOut minimo)
- [ ] **useNativeDriver**: tutte le animazioni `Animated` core usano `useNativeDriver: true`
- [ ] **Reanimated preferito**: nuovo codice usa `react-native-reanimated`, non `Animated` core
- [ ] **Nessun layout jank**: nessun salto visivo quando il contenuto cambia

### 8.13 Animazioni Esistenti — Reference Completa

Tabella di tutte le animazioni attualmente implementate nel codice:

| Componente | Pattern | Tipo | Config |
|---|---|---|---|
| Button | Press scale | transform | `scale: 0.98` (statico, no spring) |
| SelectableChip | Color toggle | timing | 180ms su bg + border + text |
| SelectableChip | Press opacity | opacity | `0.85` |
| BottomSheet | Drawer open | spring | damping: 22, stiffness: 240 |
| BottomSheet | Drawer close | timing | 260ms translateY |
| BottomSheet | Backdrop in/out | timing | 180ms / 160ms |
| BottomSheet | Drag snap-back | spring | stiffness: 220, damping: 18 |
| BottomSheet | Keyboard offset | timing | durata da evento OS |
| CalendarDrawer | Drawer open | spring | damping: 22, stiffness: 240 |
| CalendarDrawer | Drawer close | timing | 260ms |
| CalendarDrawer | Drag | PanResponder | soglia 120px / 0.9 vy |
| MiniCalendar | Month fade | timing | 220ms opacity |
| MiniCalendar | Month layout | LayoutAnimation | easeInEaseOut |
| TimePickerDrawer | Auto-scroll | scrollTo | 100ms setTimeout |
| ToastNotice | Entrata | spring + timing | damping 16–18, stiffness 280–300, opacity 200ms |
| ToastNotice | Uscita | timing | 250ms opacity + translateY + scale |
| ToastNotice | Auto-dismiss | setTimeout | 2600ms default |
| Skeleton | Pulse | timing loop | 760ms, easeInOut(quad), 0.42↔0.9 |
| BookingCelebration | Full sequence | timing | 1450ms easeOut(cubic) |
| BookingCelebration | Sparkle burst | interpolate | 5 punti radiali |
| BookingCelebration | Ring expansion | interpolate | scale 0.5→1.5, opacity 0→0.4→0 |
| ScrollHintFab | Float loop | spring loop | speed 9–10, bounce 10–12, ±7px |
| ScrollHintFab | Press | transform | `scale: 0.96` |
| SearchableSelect | Dropdown open | timing | 180ms opacity + translateY + scale |
| SearchableSelect | Dropdown close | timing | 120ms |
| RangesEditor | Row enter | FadeIn (reanimated) | 200ms |
| RangesEditor | Row exit | FadeOut (reanimated) | 150ms |

### 8.14 Web — Note per Cross-Platform

Quando queste animazioni vengono portate sulla web app:

| Concetto RN | Equivalente Web | Note |
|---|---|---|
| `react-native-reanimated` | **Framer Motion** o **CSS transitions/animations** | Framer Motion e il piu vicino come API mentale |
| `withSpring` | `transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)` | Cubic-bezier con overshoot per simulare spring |
| `withTiming` | `transition: all <duration>ms <easing>` | Mapping diretto |
| `FadeIn/FadeOut` | `@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }` | O Framer Motion `animate={{ opacity: 1 }}` |
| Stagger | Framer Motion `staggerChildren: 0.06` o `animation-delay: calc(var(--i) * 60ms)` | CSS custom properties per indice |
| `PanResponder` | Drag API HTML5 o `framer-motion` drag | `useDrag` da `@use-gesture/react` per gesture |
| `LayoutAnimation` | CSS `transition` su `height`/`max-height` o Framer `layout` prop | Framer `layout` e il piu fluido |
| Spring physics | `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy) o `cubic-bezier(0.22, 1, 0.36, 1)` (gentle) | Approssimare — web non ha spring nativo |
| `Easing.out(Easing.cubic)` | `cubic-bezier(0.33, 1, 0.68, 1)` | Ease-out standard |
| `Easing.inOut(Easing.quad)` | `cubic-bezier(0.45, 0, 0.55, 1)` | Per pulse/skeleton |

**Regola web:** preferire `transform` e `opacity` per trigger GPU compositing. Mai animare `width`, `height`, `padding`, `margin` direttamente — usare `scale` e `translate`.

---

## 9. Piattaforme

| Aspetto | iOS | Android |
|---|---|---|
| Tab bar | `GlassTabBar.ios.tsx` — BlurView nativo, effetto vetro | `GlassTabBar.tsx` — custom, bg bianco, highlight navy |
| Tabs | `NativeTabs` (Expo Router) | Custom tab bar |
| BottomSheet | `BottomSheet.ios.tsx` (implementazione specifica) | `BottomSheet.tsx` |
| Keyboard handling | `keyboardWillShow` + `keyboardWillChangeFrame` + `keyboardDidShow` | `keyboardDidShow` / `keyboardDidHide` |
| LayoutAnimation | Nativo | Richiede `UIManager.setLayoutAnimationEnabledExperimental(true)` |
| Ombre | `shadowColor` + `shadowOpacity` + `shadowRadius` + `shadowOffset` | `elevation` (valore numerico) |

**Regola:** tutto il resto e cross-platform. Niente branching `Platform.OS` nei componenti UI (eccetto BottomSheet e GlassTabBar).

---

## 10. Icone

### 10.1 Icone Vettoriali (UI funzionale)

Libreria: **`@expo/vector-icons` → `Ionicons`**

Uso: navigazione, bottoni, badge di stato, indicatori. Sempre monocromatiche.

| Icona | Size | Contesto |
|---|---|---|
| `time` | 18 | RangesEditor clock circle |
| `trash-outline` | 18 | RangesEditor rimuovi fascia |
| `add-circle` | 18 | RangesEditor aggiungi fascia |
| `search` | 20 | SearchableSelect |
| `checkmark-circle` | 22 / 46 | ToastNotice success / BookingCelebration |
| `information-circle` | 22 | ToastNotice info |
| `alert-circle` | 22 | ToastNotice danger |
| `sparkles` | 18 | BookingCelebration burst |
| `chevron-down` | 19 | ScrollHintFab |

### 10.2 Icone 3D (elementi decorativi e identita visiva)

> **SUPERATA (REG-639, 28/10/2026):** le Fluent 3D Emoji sono bandite e le icone vanno ridotte al minimo; vale §0.9. I file `assets/icons/fluent-*.png` sono stati **eliminati** (commit `302f679`): nessuna schermata li usa più. Il testo sotto resta solo come storico delle illustrazioni del **percorso teoria** (`stat-*`, `cta-*`, `review-retry`, `study-books`, `tag-theory`, `chapters/`), le uniche ancora in `assets/icons/`; la «Regola» in fondo NON vale più: le nuove icone si generano col metodo di §0.9.

Libreria (storica): **Microsoft Fluent Emoji 3D** (`assets/icons/`)

Le icone 3D danno personalita e calore all'app. Si usano per decorare card, CTA, statistiche e sezioni tematiche. **Mai** per navigazione o bottoni funzionali piccoli.

**Source:** [github.com/microsoft/fluentui-emoji](https://github.com/microsoft/fluentui-emoji) — cartella `assets/{Nome}/3D/` — PNG 256x256 con trasparenza RGBA.

**Dimensioni standard:**

| Contesto | Size (px) | Esempio |
|---|---|---|
| CTA card (azione principale) | 44x44 | Simulazione, Esercitazione |
| Stat tile (dato numerico) | 32x32 | Accuratezza, Quiz fatti |
| Inline tag / subtitle | 16x16 | "Percorso teoria" sotto il greeting |
| Card navigazione (topic list) | 52x52 | Capitolo nell'elenco argomenti |
| Banner / card orizzontale | 36x36 | Ripassa errori, countdown esame |

**Icone attualmente in uso:**

| File | Emoji | Contesto |
|---|---|---|
| `stat-accuracy.png` | Bullseye | Stat accuratezza risposte |
| `stat-quizzes.png` | Memo | Stat quiz completati |
| `stat-topics.png` | Books | Stat argomenti studiati |
| `stat-countdown.png` | Alarm clock | Countdown esame |
| `cta-exam.png` | Clipboard | CTA Simulazione esame |
| `cta-practice.png` | Graduation cap | CTA Esercitazione |
| `review-retry.png` | Counterclockwise arrows | Ripassa errori |
| `study-books.png` | Books (colorati) | Sfoglia argomenti |
| `tag-theory.png` | Open book | Tag "Percorso teoria" |
| `chapters/chapter-XX.png` | Vari (25 icone) | Icona per capitolo nella lista argomenti |

**Regola (SUPERATA, vedi §0.9 — non cercare più emoji Fluent):** quando aggiungi una nuova sezione decorativa (card, stat, CTA tematica), cerca sempre prima un'emoji Fluent 3D appropriata. Usa `require('../../assets/icons/...')` con `Image` component, mai URI remoti.

---

## 11. Z-Index Scale

| Livello | Valore | Uso |
|---|---|---|
| ScrollHintFab | `4` | Sopra il contenuto scroll |
| ToastNotice | `50` | Sopra tutto tranne modal |
| SearchableSelect container | `40` | Sopra contenuto form |
| SearchableSelect dropdown | `200` | Sopra tutto nel form |

---

## 12. Gerarchia Visiva — CTA vs Informazioni

### 12.1 Principio Fondamentale

**Le azioni devono essere "forti", i dati devono essere "silenziosi".**

L'utente deve capire a colpo d'occhio cosa e tappabile e cosa e informativo. Mai confondere card azione con card dato — devono essere visivamente opposte.

### 12.2 Card Azione (CTA)

Le CTA usano **ombre esterne concentrate** per sembrare "sollevate" dalla pagina. Invitano al tap.

| Livello | Aspetto | Ombra | Esempio |
|---|---|---|---|
| **CTA Primaria** | `bg: colors.primary`, testo bianco, `borderRadius: 26` | **Nessuna ombra** — il colore pieno fa il lavoro | "Continua a studiare" |
| **CTA Card** | `bg: colors.surface` o `#1A1A2E` (dark), icona 3D 44px, `borderRadius: 26` | `shadowOpacity: 0.14, shadowRadius: 6, height: 3` (concentrata) | Simulazione, Esercitazione |
| **CTA Secondaria** | `bg: colors.surface`, icona 3D 36px, layout orizzontale, `borderRadius: 26` | `shadowOpacity: 0.14, shadowRadius: 6, height: 3` (concentrata) | Ripassa errori |
| **Tile Schede** | bg colorato per stato, `borderRadius: 18` | `shadowOpacity: 0.1, shadowRadius: 5, height: 3` | Griglia schede |

**Press state CTA:** `opacity: 0.9, transform: [{ scale: 0.96 }]`

Ogni CTA card ha un'icona 3D Fluent prominente (44px) in alto a sinistra. L'icona e il primo elemento visivo che l'utente nota. *(Storico, percorso teoria: per le nuove card vale §0.9 — niente icona dove bastano testo e gerarchia, e mai Fluent.)*

**Principio ombre concentrate:** `shadowRadius` basso (5-6) + `shadowOffset.height` corto (3) = ombra stretta vicino alla card → effetto 3D "sollevato dal tavolo". Evitare `shadowRadius` > 10 sulle CTA (troppo disperso, sembra alone).

### 12.3 Card Informativa (Stat/Dato)

Le card informative usano **ombre interne (inset shadow)** per sembrare "incassate" nella pagina. Non invitano al tap.

```ts
// Inset shadow nativo (React Native 0.81+)
boxShadow: [
  { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.12)', inset: true },
  { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.06)', inset: true },
],
backgroundColor: '#EEEDEB',  // leggermente piu scuro del background
borderRadius: 20,
```

Stat con icone 3D (32px), numeri grossi (`fontSize: 20, fontWeight: 800`), label muted. Layout orizzontale con divider hairline tra le stat.

### 12.4 Confronto Visivo

| Proprieta | CTA (Azione) | Info (Dato) |
|---|---|---|
| Ombra | **Esterna concentrata** (radius 6, height 3) | **Interna/inset** (boxShadow inset) |
| Background | Bianco o dark (#1A1A2E) | Grigio caldo (#EEEDEB) |
| Border Radius | **26** | **20** |
| Icone 3D | 44px, prominenti | 32-34px, decorative |
| Testo valori | 15px, bold | 14-15px, bold |
| Testo label | 12px, muted | 10px, muted |
| Tappabile | Si | No |

### 12.5 Sezioni e Label

Le sezioni usano label uppercase muted per introdurre gruppi di CTA:

```ts
sectionLabel: {
  fontSize: 13, fontWeight: '700', color: colors.textMuted,
  letterSpacing: 0.5, textTransform: 'uppercase',
  marginBottom: 10,
}
```

Esempio: `PRONTO PER L'ESAME?` sopra le card Simulazione/Esercitazione.

### 12.6 Ordine Gerarchia Home (Top → Bottom)

1. **Greeting** — "Ciao, {nome}" (24px) con subtitle "Percorso teoria" + icona 3D libro (16px)
2. **CTA Primaria** — "Continua a studiare" (navy, full-width, borderRadius 26, **no shadow**)
3. **CTA Card** — Simulazione (dark) + Esercitazione (bianca) affiancate (borderRadius 26, shadow concentrata)
4. **CTA Secondaria** — "Ripassa i tuoi errori" (borderRadius 26, shadow concentrata)
5. **Stats inset** — Accuratezza / Quiz fatti / Argomenti (borderRadius 20, inset shadow, icone 3D 34px, valori 15px)
6. **Countdown** — Esame teoria (se data impostata)
7. **Sezione azionabile** — "Da migliorare" con capitoli deboli (tappabili)

### 12.7 Titoli Pagina

| Schermata | fontSize | fontWeight | letterSpacing |
|---|---|---|---|
| Home quiz ("Ciao, {nome}") | 24 | 600 | -0.3 |
| Lista argomenti ("Studio per Argomento") | 24 | 600 | -0.3 |
| Schede esame ("Schede d'Esame") | 24 | 600 | -0.3 |
| Sezione capitolo ("4. Segnali di obbligo") | 22 | 600 | -0.3 |

**Regola peso:** i titoli grandi/pagina/header/sheet usano **`fontWeight: '600'`** — NON 800 (l'800 risultava un grassetto troppo pronunciato). Vale **ovunque** (large title, header schermate, titoli dei formSheet). I numeri grandi decorativi (countdown esame, valori stat, badge) restano 800. `compactTitle` 600, sottotitoli 500.
**Regola size:** titoli pagina top-level a 24px. Sotto-pagine / titoli sheet a 20-22px. Mai superare 24px per i large title.

---

## 13. Pattern Nativi iOS

### 13.1 iOS Large Title con BlurView

> **SUPERATA (REG-639, 28/10/2026):** le schermate intere usano `ClayLargeTitleScroll` / `ClayNavBar` (§0.5): barra opaca, niente BlurView. Il testo sotto resta come storico.

Pattern per schermate con lista scrollabile. Il titolo grande scompare nello scroll e il titolo compatto appare nella barra blur.

```ts
// Header sticky
headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }
// iOS: BlurView intensity={80} tint="systemChromeMaterialLight"
// Android: View con backgroundColor rgba(255,255,255,0.92)

// Large title: opacity e translateY interpolati su scrollY
// Compact title: opacity interpolata (appare quando large title scompare)
// Border: hairline che appare con lo scroll
```

Usato in: AllievoTheoryHomeScreen, TopicListScreen, SchedaGridScreen.

### 13.2 Form sheet — IL modo di farlo (`FormSheet` + `FORM_SHEET`)

> **Regola Reglo (Tiziano, 28/10/2026): un solo componente, struttura fissa.**
> Ogni form sheet dell'app si fa così, senza eccezioni. Non si costruisce più un
> foglio a mano (ScrollView, testata, X, padding): si usa il componente.

**1. Presentazione della route** — un solo helper, `FORM_SHEET`
(`src/utils/sheetPresentation.ts`): `presentation: 'formSheet'`,
`sheetAllowedDetents: 'fitToContents'` (Android: detent alto), **niente grabber**,
fondo bianco in `contentStyle` (sotto il foglio non spunta mai il colore dello
stack). **Si chiude con la X, trascinando giù o toccando fuori** (Tiziano,
28/10/2026, REG-639 fluidità: prima era bloccato sulla sola X con
`gestureEnabled: false`, che NON va rimesso).

```tsx
// app/(tabs)/<stack>/_layout.tsx
<Stack.Screen name="my-sheet" options={FORM_SHEET} />
```

**2. Corpo del foglio** — un solo componente, `<FormSheet>`
(`src/components/SheetScaffold.tsx`):

```tsx
<FormSheet
  title="Parti con Sara"          // stringa o nodo
  subtitle="Patente B · 14ª guida"
  leading={<Avatar/> /* o chevron «indietro» */}
  cta={<Bottone/>}                 // ultima cosa del foglio
  contentKey={step}                // fogli a più passi: dissolvenza fra i passi
  onClose={...}                    // default router.back()
  busy={saving}                    // salvataggio in corso: il gesto non chiude
  dirty={hasChanges && !saving}    // modifiche non salvate: conferma prima di chiudere
  closeOnGesture                   // il gesto chiama onClose (es. riepilogo Road)
>
  {contenuto}
</FormSheet>
```

Cosa fa da solo, sempre uguale:
- **tre parti, come i fogli nativi di iOS** (Tiziano 28/10, seconda
  segnalazione: scorrendo il contenuto passava sopra il titolo e la CTA stava
  in fondo al contenuto, attaccata al bordo):
  - **testata FISSA e opaca** (bianca), con una linea sottile sotto che compare
    solo quando il contenuto le scorre sotto;
  - **centro che scorre** (`ScrollView`, `contentInsetAdjustmentBehavior="never"`);
  - **footer FISSO con la CTA** (bianco, niente fascia grigia), linea sopra solo
    se sotto c'è ancora contenuto.
  **Altezza adattiva**: se tutto ci sta, niente scroll (il form sheet abbraccia
  il contenuto); se sfora, scorre solo il centro. Il centro ha un'altezza
  ESPLICITA = min(contenuto misurato, tetto − testata − footer), tetto =
  schermo − safe area alta − `SHEET_SYSTEM_BOTTOM` (34 da iOS 26: lo spazio
  che il foglio flottante aggiunge da sé). Trappole risolte, da non
  reintrodurre: (1) niente `flexShrink` sul centro (dentro un form sheet
  fitToContents collassava a pochi punti); (2) la radice e il guscio dello
  scroll hanno `collapsable={false}` e la testata è la PRIMA vista **senza
  `zIndex`**: react-native-screens cerca uno ScrollView fra i figli diretti
  del foglio o lungo la catena delle prime viste e gli forza il frame nativo a
  tutto il foglio (con `zIndex` Fabric monta la testata dopo e lo scroll
  finiva sotto la CTA). testID: `sheet-body`, `sheet-scroll`, `sheet-foot`;
- **intestazione**: `leading` + titolo `24/600` + sottotitolo `15/400`, e la **X
  in alto a destra, nell'angolo** (`SheetCloseButton` = `ClayIconButton`
  «close»: cerchio bianco in rilievo del clay v2, §0 — identico anche nei fogli
  ancora fatti a mano, via `GlassCloseButton`). Niente eyebrow sopra il titolo;
- **chiusura col gesto** (`useSheetDismissGuard`, anche esportato per i fogli
  fuori da `FormSheet`): trascinare giù / toccare fuori chiude; con `busy` il
  gesto è spento (le chiusure via codice passano); con `dirty` ogni chiusura
  (gesto, X, codice) chiede «Vuoi uscire senza salvare?» (Resta / Esci) — dopo
  un salvataggio riuscito `dirty` deve essere già false (legarlo a `!saving`);
  con `closeOnGesture` il gesto esegue `onClose` (uscite con effetti). I fogli
  più alti dello schermo scorrono e UIKit non passa il trascinamento al
  foglio dal centro: trascinando dalla testata chiudono nativamente; tirati
  giù dal centro oltre l'inizio (64 pt) e rilasciati si chiudono, a rimbalzo
  finito (chiudere durante il rimbalzo lasciava il velo scuro piantato);
- **contenuto** che entra ed esce con dissolvenza morbida, l'altezza scivola
  (`utils/motion.ts`, niente rimbalzi, `ReduceMotion.Never`);
- **CTA (`cta`) nel footer fisso**: 10 sopra, poi solo `SHEET_BOTTOM` (0 da
  iOS 26, 18 prima — vedi §13.2.1). **Mai `insets.bottom`.** Note e
  spiegazioni stanno nel contenuto, sopra; bottoni messi nei `children` invece
  che in `cta` scorrono col contenuto;
- fondo bianco, padding laterale 22, testata 26 sopra e 14 sotto.

Liste a tutta larghezza dentro il foglio (righe native con divisori): un
contenitore con `marginHorizontal: -22` (vedi `drive/avvia.tsx`, `s.bleed`). La
ricerca sta nel contenuto, non in una testata sticky (il wrapper sticky di RN
rompe la riga titolo/X).

**Fogli già su `FORM_SHEET` + `<FormSheet>` (28/10/2026, REG-639 notte):
praticamente tutti quelli dell'app istruttore/titolare.**

- Road: `drive/avvia` (3 passi), `drive/pagellino` e `road/pagellino`
  (`manage-lesson-details` variante Road), `drive/appena-finita`,
  `road/segnala`, `road/riepilogo`, `home/road-percorso` (anche da `notes` e
  `drive`), `home/road-privacy` (anche da `drive`), `home/road-invite`.
- Agenda (stack `home/`): `add-action` («Nuovo»), `quick-book`, `new-booking`
  e `block-slot` / `theory-lesson` (`BookingForm` / `BlockForm`),
  `manage-lesson` e sottofogli (`manage-lesson-details` variante home,
  `-correct`, `-instructor`, `-vehicles`, `-location`, `-location-form`,
  `manage-co-instructors`, `cancel-fault`, `edit-notes`), `swap-lesson`,
  `reschedule-lesson`, `exam-manage`, `create-exam` (`CreateExamScreen`),
  `select-exam-students`, `create-group-lesson` (`CreateGroupLessonScreen`),
  `manage-group-lesson`, `manage-group-lesson-participants`, `sick-leave`,
  `out-of-availability`, `follow-car-conflict` e `-long`
  (`FollowCarConflictSheet`), `select-date`, `select-date-range`,
  `select-student`, `time-picker`.
- Disponibilità (stack `role/`): `availability-exception`, `publish-day`,
  `time-picker`, `instructor-invite`, `instructor-availability` (anche
  ri-esportati in `more/` per la Panoramica istruttori del titolare-istruttore).
- «Tu» (stack `more/`): `profile-edit`, `availability-mode`,
  `agenda-settings`, `location-form`, `vehicle-form`, `evaluation-item`
  (`EvaluationItemSheet`), `time-picker`, `color-picker`, `hours-period`.

**Da migrare** (ancora `SheetScaffold` legacy o un preset vecchio
`TALL_SHEET`/`HUG_SHEET`/`SCROLL_SHEET`/`PAGE_SHEET`) — sono soprattutto gli
**Allievi** (stack `notes/`) e le **route allievo**:
- condivisi Agenda/Allievi: `select-options` (`HUG_SHEET`),
  `select-options-long` (`PAGE_SHEET`), `student-settings`, `payment-history`
  (`HUG_SHEET`), `student-payments` (`PAGE_SHEET`) — in `home/` e in `notes/`;
  `notes/time-picker` (`HUG_SHEET`);
- Allievi: `notes/booking-rules` (`PAGE_SHEET`), `notes/limits`,
  `notes/extras` (`TALL_SHEET`);
- allievo: `home/lesson-detail`, `home/booking-flow`, `home/exam-detail`,
  `home/swap-detail`, `home/group-lesson-detail` (`TALL_SHEET`),
  `home/all-lessons` (`SCROLL_SHEET`), `settings/profile-edit`,
  `settings/availability` (`TALL_SHEET`), `settings/le-tue-guide`
  (`SCROLL_SHEET`), `settings/time-picker` (`HUG_SHEET`);
- componenti: `LessonsOverview`, `PaymentHistorySheet`.

`instructor-invite` e `instructor-availability` sono registrati con `FORM_SHEET`
in entrambi gli stack (`role/` e `more/`).

**Testata fissa (28/10 notte):** in `<FormSheet>` titolo, sottotitolo e X sono uno sticky header (`stickyHeaderIndices={[0]}`): restano in alto mentre il contenuto scorre sotto, così il foglio si chiude sempre con la X.

### 13.2.1 Layout interno di un form sheet — respiro e CTA in fondo

> **Regola Reglo (Tiziano, 27/10/2026) — vale per OGNI foglio.**
> - Il foglio è un **form sheet nativo** (`presentation: 'formSheet'` +
>   `sheetAllowedDetents: 'fitToContents'`), **alto quanto il contenuto**:
>   nessuno spazio bianco sotto l'ultima cosa.
> - Se il contenuto è lungo, **scorre il form sheet stesso**: la radice della
>   schermata è la `ScrollView` (meccanismo nativo del foglio, che arriva al
>   massimo dell'altezza e poi scorre). **Mai** una `View`/`ScrollView` interna
>   separata che scorre dentro un contenitore fisso (niente `hugScroll`,
>   niente scaffold con area di scroll interna).
> - **Mai page sheet per le liste lunghe**: la lunghezza non è un motivo per
>   passare a `presentation: 'modal'`. Le route `PAGE_SHEET` rimaste sono
>   storiche e si migrano quando si toccano.
> - Riferimento in codice: `app/(tabs)/home/manage-lesson-details.tsx`
>   (variante Road: radice `ScrollView` con testata, voci e CTA dentro).

Misure verificate su simulatore (iPhone 17 Pro, set. 2026) sul picker
`OptionsPickerSheet`, valide per ogni form sheet con CTA in fondo.

**Radice `ScrollView`: `contentInsetAdjustmentBehavior="never"`.** Con la
`ScrollView` come radice del foglio, iOS aggiunge da sé la safe area in fondo al
contenuto (comportamento `automatic`): sotto la CTA restavano ~50pt invece di 18
(«Parti con» di Road, 27/10/2026). Va spento su ogni radice di form sheet. La CTA
è l'**ultima cosa** del foglio: note e spiegazioni vanno sopra, mai sotto.

**iOS 26: il form sheet flottante ha già il suo respiro.** Da iOS 26 il foglio
aggiunge da sé ~33pt sotto il contenuto (misurato 27/10/2026, sia con radice
`View` sia `ScrollView`): sommarci il respiro fisso dava ~50pt sotto la CTA. Si usa
`SHEET_BOTTOM` (`src/utils/sheetPresentation.ts`): **0 da iOS 26, 18 prima**.

**La regola che costa più tempo: dentro un form sheet NON sommare `insets.bottom`.**
`useSafeAreaInsets()` restituisce la safe area della **finestra** (34pt, l'home
indicator), ma un `formSheet` hug-to-content **non arriva al bordo dello schermo**:
è già staccato per conto suo. Sommando le due cose la CTA resta a mezz'aria — nel
caso reale erano **52pt** di vuoto sotto il bottone. La safe area serve solo al
**page sheet** (`presentation: 'modal'`), che invece è a tutta altezza.

```tsx
// root dello sheet
{ paddingTop: 22, paddingBottom: scrollable ? Math.max(insets.bottom, 16) : 18 }
//                               ^ page sheet              ^ form sheet: respiro fisso
```

| Elemento | Valore | Nota |
|---|---|---|
| Preset route | `HUG_SHEET` (≤7 voci) / `PAGE_SHEET` (>7) | `src/utils/sheetPresentation.ts`; la scelta è in `optionsPickerPath()` |
| Padding top del root | `22` lista di scelte · **`26`** testata con titolo+sottotitolo | sotto i 26 la testata "parte compressa" quando in alto convivono anche i bottoncini tondi |
| Padding bottom | `18` (form sheet) · `max(insets.bottom, 16)` (page sheet) | vedi regola sopra |
| Header → contenuto | `paddingBottom: 20` (lista di scelte) · **`26`** (testata con titolo+sottotitolo) | rispettivamente titolo `20/600` hint `13/500`, e titolo `21/600` hint `13.5/500`; sempre `lineHeight 18` `marginTop 5` |
| Riga selezionabile | `minHeight 68`, `paddingVertical 17`, `paddingHorizontal 16`, `borderRadius 18` | sotto questi valori la lista "si compatta" e sembra una tabella web |
| Spazio tra righe | `gap: 10` | **niente divisori**: le righe sono superfici, non celle |
| Riga a riposo / selezionata | `#F7F7F8` / `navy[50]` + `borderWidth 1.5` `borderColor` navy | la selezione tinge **tutta la riga**, non una spunta in fondo |
| Marker selezione | cerchio `24` — a riposo bordo `navy[200]`, attivo pieno navy con check bianco | |
| CTA | `marginTop 22`, `height 54` (`CTA_HEIGHT`), `borderRadius 27` (`CTA_RADIUS`) | spenta = `#ECECEF`, testo `#A3A3AD`, **senza ombra** (non è tappabile) |
| Contatore nella CTA | pill `rgba(255,255,255,0.18)`, testo `13/700` bianco | il bottone diventa il riepilogo della scelta ("2 · Aggiungi al pagellino") |

**Due tarature della testata, non una.** `OptionsPickerSheet` è una lista di scelte:
il titolo è corto, il contenuto comincia subito, 22/20 bastano. Un foglio-form con
titolo, sottotitolo e bottoncini tondi in alto (`StudentSettingsSheet`,
`EvaluationItemSheet`) a quei valori parte compresso: lì la testata vuole **26 sopra e
26 sotto**, titolo `21`, hint `13.5`. Verificato due volte sul simulatore (set. 2026).

**Dove va un'azione distruttiva**: in **testa**, come bottoncino tondo da 33 accanto
alla × (`#FDECEC`, icona `trash-outline` 18 in `#DC2626`), mai sotto la CTA. In fondo
occupa una fascia da ~52pt che si legge come padding vuoto e toglie alla CTA il ruolo
di ultima cosa del foglio (caso reale: `EvaluationItemSheet`, set. 2026).

**Perché superfici e non righe con divisori**: vale la regola §5.0 (ombra/superficie
esterna = tappabile). Una lista di testo separata da hairline è un idioma da tabella
web: non dice che si tocca e non dà gerarchia. Vedi anche `hint` e `confirmLabel` su
`OptionsPickerData`, che permettono di spiegare **cosa** si sta scegliendo e di dare
alla CTA un'etichetta parlante invece di "Conferma".

### 13.3 Haptic Feedback

Abbinare sempre animazioni con feedback tattile (`expo-haptics`):

| Azione | Haptic | Quando |
|---|---|---|
| Risposta quiz corretta | `notificationAsync(Success)` | Swipe/tap VERO/FALSO |
| Risposta quiz sbagliata | `notificationAsync(Error)` | Swipe/tap VERO/FALSO |
| Tap bottone generico | `impactAsync(Light)` | Ogni CTA |
| Swipe card | `impactAsync(Light)` | Al rilascio swipe |

---

## 14. Regole e Divieti

### Da fare

- Usare **sempre** i token da `src/theme/` per colori, tipografia, spacing, radii
- Usare i componenti esistenti in `src/components/` — comporli, non duplicarli
- Per azioni rapide: **Modal centrata**. Per contenuti scrollabili: **FormSheet nativo** via Expo Router (`presentation: 'formSheet'`)
- Per hint/dettagli scrollabili: **FormSheet nativo** (mai BottomSheet custom, mai `<Modal>` inline)
- Avvolgere card con gradient in un `View` wrapper per l'ombra (l'ombra non funziona con `overflow: 'hidden'`)
- Touch target minimo: **44x44px** (rispettato da day cell calendario, bottoni freccia, chip)
- Animazioni: usare `useNativeDriver: true` dove possibile
- Ombre: specificare sempre **sia** `shadowColor/Opacity/Radius/Offset` (iOS) **sia** `elevation` (Android)
- **Icone 3D**: poche, generate con l'AI in stile unico, mai Fluent (§0.9)
- **Foto e dati che caricano (giro Road, 28/10/2026)**: mai a scatto. Dati → skeleton sobrio con la forma del contenuto (`SkeletonBlock`, grigio clay che respira, niente rotelle dove c'è un layout noto). Foto remote → sempre `FadeImage` (`src/components/FadeImage.tsx`): skeleton sotto, dissolvenza ~200 ms, mai spenta da Riduci movimento. Avatar → `UserPhotoCircle`/`Avatar` (skeleton finché non si sa se c'è la foto, poi foto o iniziali). Cache: mappa id→URL in AsyncStorage (`userPhotos`) + file su disco (`photoDiskCache`, `cacheDirectory/photos/`): alla seconda apertura i volti sono già lì. Niente expo-image finché non c'è una build nativa che lo includa.
- **Icone Ionicons** per UI funzionale: navigazione, bottoni, badge stato
- **Inset shadow** (`boxShadow` con `inset: true`) per card informative non tappabili
- **Ombre esterne** per CTA e card tappabili
- **Gerarchia CTA chiara**: la distanza visiva tra azioni e informazioni deve essere evidente (vedi sezione 12)
- **Colore Reglo solo per CTA**: navy (#1A1A2E) riservato a bottoni primari, tab bar attiva, piccoli tag. Mai per sfondi grandi o card informative
- **iOS Large Title** per schermate con lista: BlurView header + titolo che collassa
- **FormSheet nativi = niente grabber, X in alto a destra.** Nel route: `sheetGrabberVisible: false`. Nello screen, come PRIMO figlio del root: un `topBar` con la pill X (`closeBtn` 34×34, bg `#E2E8F0`, `Ionicons name="close"` → `router.back()`). Pattern di riferimento: `app/(tabs)/home/swap-lesson.tsx`. Vale per TUTTI i formSheet (mai l'handle nativo).
- **Liste = righe FLAT sullo sfondo** (icona + testo + chevron/`•••`), separate da divider hairline. La card si usa **solo per elementi singoli/standalone** (es. hero profilo, "Sede principale"). Vedi `MoreScreen.tsx`, `LocationsScreen.tsx`.
- **Azioni per riga in un menu nativo** (`ActionSheetIOS` / `Alert` su Android), non bottoni inline dentro la riga — la riga resta pulita. **Tap sulla riga = azione primaria** (es. apri il formsheet di modifica); il `•••` apre il menu secondario (Maps/Elimina).
- **"Aggiungi" / "Nuovo" = icona `+` nell'header** (alto a destra), pattern mobile nativo. Mai un bottone "Aggiungi" piazzato in mezzo alla pagina.
- **Testo visivamente leggero**: righe di lista / voci / body → `'400'`; titoli e nomi → `'500'`–`'600'` max. Mai `'700'`/`'800'` (vedi §2). Confronto di riferimento: Airbnb.

### Da NON fare

- **Non** wrappare una **lista in una card** (card bianca con dentro N righe). Le liste vanno flat sullo sfondo con divider hairline; la card è solo per item singoli/standalone.
- **Non** mettere bottoni di azione inline dentro ogni riga di lista (Maps/Modifica/Elimina ecc.) — usare un menu nativo aperto dalla riga.
- **Non** usare font-weight pesanti (`700`/`800`) né `600` su righe di lista/body — l'utente vuole leggerezza visiva.

- **Non** usare `BlurView` / `expo-blur` eccetto negli header sticky (iOS Large Title pattern) e `GlassTabBar.ios.tsx`
- **Non** creare nuovi primitivi — estendi quelli esistenti
- **Non** hardcodare colori senza motivo — usa i token da `colors.ts`
- **Non** usare radii arbitrari — segui la scala: `radii.sm` (20), `radii.lg` (35), `999` (pill), o valori inline documentati
- **Non** usare BottomSheet per contenuti read-only — preferisci PageSheet nativo
- **Non** approssimare i valori Figma — riproduci esattamente dimensioni, colori, spacing
- **Non** usare class component — solo functional component con hooks
- **Non** animare `width`/`height` — usare `transform` e `opacity` per performance
- **Non** aggiungere icone Fluent 3D (bandite, §0.9) né icone decorative dove bastano testo e gerarchia
- **Non** usare icone 3D per bottoni funzionali piccoli (nav, close, chevron)
- **Non** dare ombre esterne a card informative — usare inset shadow
- **Non** dare inset shadow a CTA — usare ombre esterne
- **Non** usare colore navy per sfondi grandi, card informative, o elementi non interattivi

---

## 15. Fluidità e prestazioni (regola permanente, Tiziano 29/10/2026)

> Lezioni di REG-639 «Road fluida» (commit 69cb0c3). Valgono per ogni schermata e vincono sul §8 quando lo contraddicono. Il metro di paragone è il foglio di dettaglio allievo: deve sentirsi tutto così.

1. **Il tocco anima, il contenuto segue.** Un tocco che anima (cursore, anello, segmentato) non ricostruisce mai liste o UI pesante nello stesso fotogramma. Prima parte l'animazione, poi il contenuto arriva come aggiornamento non urgente (`startTransition` o `InteractionManager.runAfterInteractions`) e compare in dissolvenza. Riferimento: `changeSegment` in `InstructorNotesScreen.tsx`.
2. **Le varianti che si alternano restano montate.** Filtri, allievo selezionato e simili restano montati e pronti: si nascondono (`display: 'none'`, opacità) o si sovrappongono in dissolvenza incrociata ad altezza fissa. Niente `key` che li rimontino.
3. **Liste lunghe solo con `FlatList`** (anche nei fogli: `FormSheet list`) e righe in `React.memo`. Niente `.map()` di decine di righe dentro una `ScrollView`.
4. **Niente `MapView` ripetute nelle liste.** Le miniature sono immagini salvate (`takeSnapshot` → `src/road/thumbCache.ts`). La mappa grande si monta una volta sola, in anticipo e a riposo.
5. **Niente layout transitions né entrate dal basso** (`FadeInDown`, stagger, `layout=`) su contenitori con ombre. Solo dissolvenze da 150–200 ms (`ROAD_FADE_IN`/`ROAD_FADE_OUT`, `CROSSFADE_TIMING` in `src/utils/motion.ts`).
6. **Strati minimi sui componenti ripetuti.** Su iOS ogni voce di `boxShadow` costa uno strato in più e un rendering fuori schermo. Volti, righe e celle hanno una sola ombra esterna. Lucentezze e bordini vanno cotti in un'immagine fissa (`Avatar.tsx`). Le animazioni stanno solo dove c'è davvero una selezione.
7. **Schermate grandi in sezioni con `memo`**, con props stabili (`useCallback`, dati confrontati prima di `setState`). Niente timer che le ridisegnano e niente ricaricamento se a ogni focus arrivano dati identici.
8. **Nessun fetch al tocco.** I dati si caricano prima (warm-up all'avvio o al focus, cache di modulo) e al tocco sono già pronti. L'aggiornamento di rete arriva dopo, senza bloccare l'animazione.
