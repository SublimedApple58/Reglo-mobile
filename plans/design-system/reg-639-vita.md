# Dare vita all'app — direzione approvata «D · Mix» (REG-639, 28/10/2026)

## Stato

- **28/10 — parte mobile FATTA e APPROVATA da Tiziano** (le 4 schermate: Agenda,
  «Nuovo» con alone, Disponibilità con foto, «Tu»). Solo commit locali su
  `feat/reg-639-clay-ds` (c5033cf, fe2c5be), niente push né OTA. Riepilogo nel
  design system §0.4b.
  - immagini in `assets/vita/` (1x/@2x/@3x; icone OPACHE su bianco puro, cartina e foto JPG), registro `src/theme/vitaArt.ts`;
  - Agenda: saluto con l'ora, `AgendaTodayCard`, campanella 3D sull'avviso;
  - «Nuovo»: card «Guida» con `cartina-road`, auto `car34Art(colore veicolo)` su alone bianco sfocato, nome del veicolo esclusivo (senza colore: rossa); icone libere sul bianco;
  - Disponibilità: copertina **foto realistica** `sede-foto` (Gemini, al posto della cartina illustrata, poi eliminata) con velo leggero + card con `WeekStrip`; sabato e domenica restano righe separate (servono per modificarli);
  - «Tu»: `MonthHoursCard` su `getInstructorHoursRange` (leggibile dall'istruttore; passato `instructorId`, così il titolare-istruttore vede solo sé), lista unica.
- **Copertina della sede (passo 2, 28/10)**: fatta, in STAGING (web `reglo`
  `feat/reg-639-sede-foto`, migrazione `20261101120000_location_cover_photo`).
  Foto **solo della sede** (`AutoscuolaLocation.coverPhotoKey`, `isDefault`),
  caricata dal titolare in Impostazioni → «Sede e luoghi»; il mobile legge
  `coverPhotoUrl` da `/api/mobile/me` (luogo di default del membro se ha foto,
  altrimenti sede, altrimenti segnaposto `sede-foto`; se l'URL non si carica,
  segnaposto). Mobile pronto sul branch `feat/reg-639-sede-foto`: OTA solo col
  via di Tiziano e DOPO il backend in prod.
- **Foto dei veicoli**: non si fanno (Tiziano 28/10). Facoltativo: nome del
  veicolo sulla riga «Veicoli» di «Tu» (una chiamata in più).

- **Approvata da Tiziano il 28/10** la tavola `D-mix` (`/tmp/hiro-anteprime/vita/D-mix.png`,
  sorgente `gen.py` nella stessa cartella).
- Nata dal feedback: le schermate clay (ombre, radius, struttura giusti) erano
  **asettiche**. Esplorate 3 direzioni (A oggetti caldi, B persone e posti,
  C traguardi); scelto un mix. Reglo Road resta com'è.
- Icone di prova Gemini (`/tmp/hiro-anteprime/vita/icone-prova/`, metodo: blocco
  STILE §0.4 + 2 reference di Gabriele): **calendario e volante approvate,
  patente da rifare** (poi uscita dal piano: serviva solo ai traguardi).

## Decisioni di Tiziano (28/10, dopo l'approvazione)

1. **Niente Traguardi in «Tu»**: tolta la riga e l'endpoint traguardi. «Tu» tiene
   il numero del mese e il grafico.
2. **Saluto dell'Agenda con l'ora**: Buongiorno / Buon pomeriggio / Buonasera.
   Fasce proposte: fino alle 13:00, poi fino alle 18:00, poi sera.
3. **Foto di veicolo e sede le carica il titolare dalla web app.** Se mancano, al
   loro posto va un **segnaposto curato, generato da noi**, mai vuoto né triste:
   - **veicolo** → l'auto 3D nel colore del veicolo sopra la `cartina-road`;
   - **sede** → un'illustrazione calda, `sede-cartina`: cartina Road con l'edificio 3D al centro.

## La direzione, schermata per schermata

Base invariata: bianco puro, testo nero, clay leggero, CTA variante A, niente
pillole/badge/puntini colorati. In più: **oggetti 3D colorati e caldi (mai
scuri)**, **foto vere**, **un numero che conta** e **micro-copy umano**.

1. **Agenda, intestazione (da A)**
   - Saluto sopra il titolo, con l'ora: «Buongiorno / Buon pomeriggio / Buonasera, Tiziano».
   - Card clay «Oggi N guide» con il calendario 3D; sotto, «La prima alle 9:00 · pausa caffè alle 10».
   - Avviso «1 guida fuori disponibilità · Gestisci» in card clay con la campanella 3D.
   - Griglia settimanale invariata.
2. **Foglio «Nuovo» (da B)**
   - In cima la card clay «Guida / Con un allievo, sulla Ford fiesta». La parte alta è una
     **cartina in stile Road** (chiara, strade bianche, toni caldi, percorso tratteggiato)
     con l'auto 3D sopra, nel colore del veicolo.
   - Sotto, le righe nell'ordine di B: Guida di gruppo, Esame, Lezione teorica, Blocca un
     orario, Malattia.
   - Le icone sono **libere sul bianco**, senza riquadri tinti. Guida di gruppo mostra i
     volti degli allievi sovrapposti.
3. **Disponibilità (da B)**
   - Copertina con la **foto della sede** (se manca: illustrazione `sede-cartina`); sopra, la card clay «Disponibilità /
     Quando gli allievi possono prenotarti».
   - Mini-calendario dei 7 giorni con le fasce in nero.
   - Poi le righe lun–ven e «Weekend · Libero» (se sab e dom sono entrambi liberi).
4. **Tu (da C)**
   - Foto profilo in alto a destra.
   - Card del mese: «OTTOBRE · 46 h guidate · 52 guide» con il grafico a barre.
   - Poi le righe senza icone: Ore di guida, Veicoli (con il nome del veicolo a destra),
     Luoghi guida, Pagellino, Aspetto agenda, Impostazioni.

## Cosa serve per implementarla

### 1. Icone 3D da generare (Gemini, blocco STILE §0.4 + reference Gabriele)

Regola: colori caldi, niente parti grandi nere, niente blu.

| # | Nome file | Dove | Stato |
|---|-----------|------|-------|
| 1 | `calendario` | card «Oggi» in Agenda, «Blocca un orario» | **approvata** (prova 28/10), sostituisce `icons3d-ai/calendario` |
| 2 | `volante` | stato vuoto dell'Agenda («giornata libera») e riserva per «Guida» senza veicolo | **approvata** (prova 28/10) |
| 3 | `esame` | riga «Esame» del foglio «Nuovo» | da rigenerare più calda (oggi tocco nero grande) |
| 4 | `edificio` | riga «Lezione teorica»; anche dentro `sede-cartina` | da rigenerare più calda (finestre nere) |
| 5 | `termometro` | riga «Malattia» | **nuova** |
| 6 | `cartina-road` | sfondo della card «Guida» e segnaposto della foto veicolo (con l'auto sopra) | **nuova**: illustrazione statica larga (circa 370×138 pt @3x), non una mappa vera |
| 7 | ~~`sede-cartina`~~ → `sede-foto` | segnaposto della copertina di Disponibilità | sostituita il 28/10 da una **foto realistica** (Gemini), 402×212 pt |
| — | `campanella` | avviso «fuori disponibilità» | c'è (set Road, ambra): si riusa |
| — | `persone` | «Guida di gruppo» quando gli allievi non hanno foto | c'è: si riusa |
| — | auto 3/4 colorate | card «Guida» e segnaposto veicolo | ci sono (`assets/road/cars/auto-34-*`) |

Uscite col taglio dei traguardi: `patente` (era da rifare), ritocco `trofeo`;
`espresso` e `piantina` restano solo dove già sono (stati vuoti, `MORALE_ART`).

Totale: **5 da generare** (esame, edificio, termometro, cartina-road,
sede-cartina) + 2 già approvate (calendario, volante).

### 2. Foto da caricare

| Foto | Esiste già? | Cosa serve |
|------|-------------|-----------|
| Profilo istruttore | sì: `photoUrl` su `/me` e `/api/autoscuole/user-photos` | farla caricare a chi non ce l'ha; senza foto si usano le iniziali (Avatar clay) |
| Volti degli allievi (Guida di gruppo) | sì: `getUserPhotos` | niente; senza foto si usano le iniziali, oppure l'icona `persone` se nessuno ha la foto |
| Veicolo | **no**: `AutoscuolaVehicle` non ha foto | backend: campo `photoUrl` + upload **dalla web app, lo fa il titolare** (modulo veicoli). Il mobile solo legge. Senza foto: auto 3D nel colore del veicolo (`carColor`, come in Road) sopra `cartina-road` |
| Sede / autoscuola | **no**: `Company` ha solo `logoUrl` | backend: campo `coverPhotoUrl` + upload **dalla web app, lo fa il titolare** (Impostazioni autoscuola). Il mobile solo legge. Senza foto: illustrazione `sede-cartina` |

### 3. Dati ed endpoint per i numeri

| Dato | Fonte | Lavoro |
|------|-------|--------|
| «Oggi N guide · la prima alle …», pausa | agenda già caricata (client) | solo mobile |
| «N guide fuori disponibilità» | c'è già | — |
| Mini-calendario Disponibilità, «Weekend · Libero» | disponibilità già caricata | solo mobile |
| Ore e guide del mese + grafico | `getInstructorHoursRange({from,to})` esiste (`total.totalMinutes`, `appointmentCount`, `buckets`) | mobile. Oltre 14 giorni i bucket sono **settimane**: il grafico mostra le settimane del mese, non i giorni. Va verificato che l'istruttore possa leggere le proprie ore |

Ordine suggerito: icone → Agenda e «Nuovo» (zero backend) → Disponibilità
(con `sede-cartina` finché non c'è la foto) → Tu con le ore del mese → campi
foto veicolo e sede con upload web (full-stack, branch anche su `reglo/`).

## Decisioni aperte

- Nessuna di prodotto. Da confermare solo all'implementazione le fasce orarie
  del saluto (13:00 / 18:00).
