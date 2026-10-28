# Icone 3D — piano (REG-639, 28/10/2026)

## Cosa è stato fatto (28/10/2026)

- 15 icone generate su Gemini (account Reglo) con il blocco STILE, tavola
  approvata da Tiziano così com'è. Correzioni rispetto al piano: niente blu
  (rotonda = isola verde, parcheggio = cartello nero, pedoni = strisce),
  tachimetro con lancetta spessa e 5 tacche, stop senza staffa.
- Nell'app: stessi nomi di file in `assets/road/` con `@2x`/`@3x`; auto
  ricolorate dalla rossa nelle 10 tinte; voci personalizzate = icona «altro».
- Tolte le 10 icone della tabella 1; eliminato `src/theme/icons3d.ts`,
  `Icon3D` solo `source`, `ClayStat` senza icona, `ClayListRow` senza
  `subtitleIcon`; toast in guida con cerchio bianco (le icone scure si leggono).
- Fluent eliminate dal bundle: solo quelle senza più riferimenti
  (`fluent-office`, `fluent-road`, `f-cus`, `f-loc`); le altre restano in
  ~25 schermate non Road, da sostituire al prossimo giro.
- Regola e prompt di stile: design-system §0.4.

---


Regola nuova di Tiziano: **meno icone**; quelle che restano sono **3D di alta
qualità, generate con l'AI in uno stile unico tipo Airbnb**. Via tutte le
Fluent 3D Emoji.

Foglio con le icone di oggi: `icone-oggi.png` (stessa cartella).

Oggi in Road e nelle schermate toccate sono in uso **21 immagini diverse**
(6 emoji Fluent, emblema Road, puntina, 12 segnalazioni, voce personalizzata;
più 7 Fluent rimaste nel registro senza uso dopo la tab bar, e 20 auto) da tre famiglie che non si somigliano: emoji Fluent
(calendario, sveglia, palazzo…), segnali quasi realistici (stop, precedenza,
due auto) e quadrati blu stile emoji (rotonda, svolta, parcheggio).
Proposta: **15 soggetti**, tutti nuovi e nello stesso stile.

---

> **28/10, aggiornamento Tiziano: NIENTE BLU** in nessuna icona. Rotonda,
> parcheggio e pedoni (cartelli blu in Italia) vanno ripensati senza blu:
> da decidere dopo la prova di stile.

## 1. Inventario di oggi e decisione

### Da TOGLIERE (bastano testo e gerarchia)

| # | Dove | Icona di oggi | Perché va via | Cosa resta |
|---|---|---|---|---|
| 1 | Tab Road, CTA «Compila il pagellino» (`drive/index.tsx:282`) | memo Fluent | una CTA nera non ha bisogno di disegnino | solo testo |
| 2 | Guida in corso, tasto «Pagellino» nella testata (`road/index.tsx:291`) | memo Fluent | idem | solo testo |
| 3 | Tab Road, briefing «Fabrizio · Nessuna guida da 14 giorni» (`drive/index.tsx:360`, `REASON_ICON`) | calendario / tocco / sveglia / strada | il motivo è già scritto | riga di testo, nome in nero |
| 4 | Guida in corso, banner «In agenda: …» (`road/index.tsx:321`) | calendario Fluent | il testo dice già «In agenda» | testo + «Annulla» |
| 5 | Riepilogo, riga «In agenda diventa …» (`riepilogo.tsx:150`) | calendario Fluent | nota di servizio | testo secondario |
| 6 | Riepilogo, card Pagellino (`riepilogo.tsx:104`) | memo / spunta verde | lo stato è nel titolo («Pagellino compilato») | titolo + CTA |
| 7 | Riepilogo e Percorso, tre statistiche (`ClayStat` in `riepilogo.tsx:141-143`, `road-percorso.tsx:59-61`) | strada / sveglia / memo | il numero grande È il contenuto | numero + unità + etichetta |
| 8 | Informativa Road, tre righe (`road-privacy.tsx`) | strada / palazzo / calendario | tre righe di testo si leggono meglio | titolo in nero + testo |
| 9 | Invito Road, tre righe (`road-invite.tsx:80-88`) | puntina / stop / memo | elenco di vantaggi, non serve figura | testo; l'auto in alto resta |
| 10 | Mappa della tab Road, sede (`drive/index.tsx:457`) | palazzo Fluent | basta un punto | punto nero in cerchio bianco + «Sede» |
| 11 | Registro `ICONS_3D` (`src/theme/icons3d.ts`) | agenda, people, profile, motorcycle, book, swap, bell | erano solo della tab bar clay, bocciata: oggi inutilizzate | si svuota; `Icon3D` resta per le icone tenute |

Con 1–10 tolte, anche `calendar`, `exam`, `clock`, `headquarters`, `check`,
`memo` escono dal registro: **nessuna emoji Fluent resta in Road**.

### Da TENERE (e rigenerare)

| Soggetto | Dove vive | Perché resta |
|---|---|---|
| **12 segnalazioni Road** (stop, precedenza, distanza, velocità, semaforo, rotonda, svolta, corsia, pedoni, specchietti, parcheggio, altro) | puntine sulla mappa, griglia «Cosa è successo?», righe del briefing, elenco segnalazioni, toast | sulla mappa il testo non ci sta: l'icona È l'informazione. Chiavi = contratto col backend, i file mantengono il nome |
| «Altro» + voci dell'autoscuola (`custom:*`) | come sopra | **un'icona sola** per tutte e due (oggi sono due: foglio con matita e puntina) |
| **Auto della guida, vista 3/4** | «Parti con» (riepilogo e lista auto), invito Road | è l'oggetto della guida, e ha il colore vero del veicolo |
| **Auto della guida, vista dall'alto** | mappa durante la guida | è la posizione in tempo reale |
| **Emblema Road** | card Road in agenda (`RoadLessonCard`, prossimo giro) | unico segno di riconoscimento della funzione |

**Totale da generare: 15 soggetti** (12 segnalazioni + 2 auto master + 1 emblema).
Le 10 tinte dell'auto non si generano una per una: si genera l'auto **una
volta per vista** e si ricolora la carrozzeria in post (maschera + spostamento
di tinta, come oggi), così le 20 auto restano identiche tra loro.

---

## 2. Stile comune (da incollare in testa a ogni prompt)

Scritto in inglese perché i modelli di immagine lo seguono meglio.

```
STYLE — Reglo icon set. Premium 3D icon in the spirit of Airbnb's 2025 app
icons: a real-world object, softly simplified, friendly but adult, 3 to 6
clean shapes, readable at 28 px.
Material: matte satin "soft-touch" plastic / ceramic, very slightly puffy
edges, generous rounded bevels, a hint of subsurface softness; no chrome,
no glass, no glitter, no plush.
Light: one large soft key light from the top-left (about 45°), faint warm
fill from the right, thin cool rim light on top edges, soft ambient
occlusion in creases; gentle highlights only, nothing blown out.
Camera: three-quarter view from slightly above (about 25° elevation, object
turned about 30° to the left), long lens with little perspective
distortion, object centered and filling about 78% of the square frame,
same scale and same camera for every icon in the set.
Background: plain pure white #FFFFFF, perfectly flat and uniform (it will
be cut out), no floor, no backdrop, no cast shadow, no vignette, no frame.
Palette: off-white #F4F2EE and warm light greys, near-black #1A1A1A for
details, plus ONE saturated accent per icon chosen from: signal red #E5484D,
amber #F5A524, leaf green #2FA36B. NO blue anywhere. Never pink, purple,
neon or rainbow gradients.
Output: 1024 x 1024.
NEGATIVE: emoji style, cartoon faces or eyes, hyperrealistic photo, logos,
brand marks, watermark, text (unless asked), outline strokes, background
colour, ground shadow, isometric pixel art, pink, purple, blue.
```

Per la coerenza: la prima icona approvata (consiglio lo **stop**) diventa
**immagine di riferimento di stile** per tutte le altre, con lo stesso seed
dove il modello lo permette. Se il modello non fa l'alfa, si genera su
bianco puro `#FFFFFF` e si scontorna dopo.

---

## 3. Prompt per soggetto (dopo il blocco STYLE)

**Segnalazioni Road** — file `assets/road/…`, chiave backend tra parentesi.

1. **Stop** (`stop`, `s-stop.png`) — `A small Italian STOP road sign: red octagon (#E5484D) with a thick off-white border and the word "STOP" in bold white sans-serif, on a short off-white post seen cut just below the sign.`
2. **Precedenza** (`precedenza`, `s-prec.png`) — `An Italian "give way" sign: downward-pointing triangle with a thick rounded red border (#E5484D) and off-white centre, on a short off-white post.`
3. **Distanza di sicurezza** (`distanza`, `s-dist.png`) — `Two tiny rounded city cars one behind the other in an off-white and near-black palette, with a clear gap between them marked by two short amber (#F5A524) bars on the asphalt tile under them. Small rounded asphalt tile, dark grey.`
4. **Velocità** (`velocita`, `f-vel.png`) — `A round car speedometer dial, off-white face, near-black tick marks, a red (#E5484D) needle pushed far to the right, thick soft bezel.`
5. **Semaforo** (`semaforo`, `f-sem.png`) — `A compact traffic light with a near-black rounded housing and three lenses: red (#E5484D) lit and glowing softly, amber and green dim.`
6. **Rotonda** (`rotonda`, `f-rot.png`) — `An Italian roundabout sign: blue (#2F6FDE) disc with three curved off-white arrows chasing each other anticlockwise, thick soft rim.`
7. **Svolta** (`svolta`, `f-svo.png`) — `A small rounded asphalt tile with a white painted turn arrow curving to the right, edges of the tile softly bevelled.`
8. **Corsia** (`corsia`, `f-cor.png`) — `A small rounded asphalt tile seen from above at three-quarter angle with two lanes: dashed white centre line and solid amber (#F5A524) edge line, one lane slightly highlighted.`
9. **Pedoni** (`pedoni`, `f-ped.png`) — `An Italian pedestrian-crossing sign: blue (#2F6FDE) square with rounded corners, off-white triangle inside with a near-black walking figure on zebra stripes.`
10. **Specchietti** (`specchietti`, `f-spe.png`) — `A car side mirror alone: rounded off-white housing, softly reflective light-grey mirror glass, a small amber (#F5A524) indicator strip on the housing.`
11. **Parcheggio** (`parcheggio`, `f-par.png`) — `An Italian parking sign: blue (#2F6FDE) rounded square with a bold off-white "P".`
12. **Altro + voci dell'autoscuola** (`altro` e `custom:*`, un file solo `f-alt.png`, `f-cus.png` lo stesso) — `A map pin: near-black (#1A1A1A) rounded teardrop with a small off-white circle in the head, short soft point.`

**Auto della guida** — si generano in **rosso** (`#E5484D`) e si ricolorano.

13. **Auto 3/4** (`auto-34-*.png`) — `A small modern European city hatchback, generic, no logos, five doors, red body (#E5484D), near-black windows with a soft reflection, off-white wheels with near-black tyres, a small off-white driving-school roof sign without any text. Same three-quarter camera as the set, nose pointing to the left.`
14. **Auto dall'alto** (`auto-su-*.png`) — `The same city hatchback seen from directly above (top-down, 90°), nose pointing up, red body (#E5484D), near-black windscreen and rear window, off-white roof sign without text, symmetrical. Transparent background.` *(questa è l'unica fuori dalla camera comune: serve per la mappa)*

**Emblema Road**

15. **Road** (`road-3d.png`) — `A small rounded asphalt road tile curving gently into the distance with a dashed white centre line, and a red (#E5484D) map pin standing on it.`

---

## 4. Dopo la generazione (non ora)

- Si generano prima **stop + auto 3/4** come prova di stile → anteprima a Tiziano.
- Approvate quelle, le altre 13 con lo stop come riferimento → foglio unico di confronto.
- Esportazione PNG 1024 → asset a 256 px (bastano fino a 3x per 80 pt).
- Nel codice: stessi nomi di file (niente cambi in `markerArt`), tolti gli usi della tabella 1, `ICONS_3D` svuotato, `ClayStat` senza icona. Poi design-system §0.4: la regola «meno icone».
