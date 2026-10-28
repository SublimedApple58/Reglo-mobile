# Dare vita all'app — direzione approvata «D · Mix» (REG-639, 28/10/2026)

## Stato

- **Approvata da Tiziano il 28/10** la tavola `D-mix` (`/tmp/hiro-anteprime/vita/D-mix.png`,
  sorgente `gen.py` nella stessa cartella). Il codice dell'app NON è ancora toccato.
- Nata dal feedback: le schermate clay (ombre, radius, struttura giusti) erano
  **asettiche**. Esplorate 3 direzioni (A oggetti caldi, B persone e posti,
  C traguardi); scelto un mix. Reglo Road resta com'è.
- Icone di prova Gemini (`/tmp/hiro-anteprime/vita/icone-prova/`, metodo: blocco
  STILE §0.4 + 2 reference di Gabriele): **calendario e volante approvate,
  patente da rifare**.

## La direzione, schermata per schermata

Base invariata: bianco puro, testo nero, clay leggero, CTA variante A, niente
pillole/badge/puntini colorati. In più: **oggetti 3D colorati e caldi (mai
scuri)**, **foto vere**, **un numero che conta** e **micro-copy umano**.

1. **Agenda, intestazione (da A)**
   - Saluto sopra il titolo: «Buongiorno, Tiziano» (buongiorno / buon pomeriggio / buonasera).
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
   - Copertina con la **foto della sede**; sopra, la card clay «Disponibilità /
     Quando gli allievi possono prenotarti».
   - Mini-calendario dei 7 giorni con le fasce in nero.
   - Poi le righe lun–ven e «Weekend · Libero» (se sab e dom sono entrambi liberi).
4. **Tu (da C)**
   - Foto profilo in alto a destra.
   - Card del mese: «OTTOBRE · 46 h guidate · 52 guide» con il grafico a barre.
   - Riga «Traguardi» con 4 oggetti 3D; quelli non raggiunti sono in grigio.
   - Poi le righe senza icone: Ore di guida, Veicoli (con il nome del veicolo a destra),
     Luoghi guida, Pagellino, Aspetto agenda, Impostazioni.

## Cosa serve per implementarla

### 1. Icone 3D da generare (Gemini, blocco STILE §0.4 + reference Gabriele)

Regola: colori caldi, niente parti grandi nere, niente blu.

| # | Nome file | Dove | Stato |
|---|-----------|------|-------|
| 1 | `calendario` | card «Oggi» in Agenda, «Blocca un orario» | **approvata** (prova 28/10), sostituisce `icons3d-ai/calendario` |
| 2 | `volante` | stato vuoto dell'Agenda («giornata libera») e riserva per «Guida» senza veicolo | **approvata** (prova 28/10) |
| 3 | `patente` | traguardo «allievi promossi» | **da rifare** |
| 4 | `campanella` | avviso «fuori disponibilità» | c'è (set Road, ambra): si riusa |
| 5 | `esame` | riga «Esame» del foglio «Nuovo» | da rigenerare più calda (oggi tocco nero grande) |
| 6 | `edificio` | riga «Lezione teorica» | da rigenerare più calda (finestre nere) |
| 7 | `termometro` | riga «Malattia» | **nuova** |
| 8 | `trofeo` | traguardo «N guide con Reglo» | ritocco: base non nera |
| 9 | `espresso` | traguardo «nessuna guida annullata nel mese» | c'è (morale): si riusa |
| 10 | `piantina` | traguardo «1 anno con l'autoscuola» | c'è (morale): si riusa |
| 11 | `persone` | «Guida di gruppo» quando gli allievi non hanno foto | c'è: si riusa |
| 12 | `cartina-road` | sfondo della card «Guida» (illustrazione, non mappa vera) | **nuova**: asset statico largo (circa 370×138 pt @3x) |
| 13 | auto 3/4 colorate | card «Guida» | ci sono (`assets/road/cars/auto-34-*`) |

Totale da generare: **5** (patente, esame, edificio, termometro, cartina-road)
più 1 ritocco (trofeo).

### 2. Foto da caricare

| Foto | Esiste già? | Cosa serve |
|------|-------------|-----------|
| Profilo istruttore | sì: `photoUrl` su `/me` e `/api/autoscuole/user-photos` | farla caricare a chi non ce l'ha; senza foto si usano le iniziali (Avatar clay) |
| Volti degli allievi (Guida di gruppo) | sì: `getUserPhotos` | niente; senza foto si usano le iniziali, oppure l'icona `persone` se nessuno ha la foto |
| Veicolo | **no**: `AutoscuolaVehicle` non ha foto | backend: campo `photoUrl` + upload nel modulo veicoli (web e mobile). Senza foto si usa l'auto 3D nel colore del veicolo (`carColor`, come in Road) |
| Sede / autoscuola | **no**: `Company` ha solo `logoUrl` | backend: campo `coverPhotoUrl` + upload da web (Impostazioni autoscuola). Senza foto la copertina usa la `cartina-road` |

### 3. Dati ed endpoint per numeri e traguardi

| Dato | Fonte | Lavoro |
|------|-------|--------|
| «Oggi N guide · la prima alle …», pausa | agenda già caricata (client) | solo mobile |
| «N guide fuori disponibilità» | c'è già | — |
| Mini-calendario Disponibilità, «Weekend · Libero» | disponibilità già caricata | solo mobile |
| Ore e guide del mese + grafico | `getInstructorHoursRange({from,to})` esiste (`total.totalMinutes`, `appointmentCount`, `buckets`) | mobile. Oltre 14 giorni i bucket sono **settimane**: il grafico mostra le settimane del mese, non i giorni. Va verificato che l'istruttore possa leggere le proprie ore |
| Traguardi | **non esiste** | backend nuovo: `GET /api/autoscuole/instructor/milestones` → `{ totalLessons, passedStudents, cancelledThisMonth, memberSince }`. `passedStudents` viene dall'esito esame REG-513. Soglie (50/100/250/500 guide, 1 anno…) da decidere con Tiziano |

Ordine suggerito: icone → Agenda e «Nuovo» (zero backend) → Disponibilità
(senza foto della sede, con la cartina) → Tu con le ore del mese → endpoint
traguardi → campi foto veicolo e sede (full-stack, branch anche su `reglo/`).

## Decisioni aperte

- Soglie e testi dei traguardi; cosa mostrare se un traguardo non è raggiunto
  (grigio, come in mockup, o nascosto).
- Il saluto cambia con l'ora? (proposta: sì, 3 fasce.)
- Foto veicolo e sede: chi le carica (titolare da web) e se servono a tutti o
  solo alle autoscuole che le mettono.
