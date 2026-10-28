# REG-639 — giro «memorabile»: vita dosata per importanza

**Stato (28/10 sera): tutto il piano implementato, in attesa dell'ok di
Tiziano per il rilascio unico** (niente merge/push/OTA prima). Branch
`feat/reg-639-memorabile`. Tavole prima/dopo: `/tmp/hiro-anteprime/memorabile/`
1 Pagamenti · 2 dettaglio allievo · 3 storico · 4 icone · 5 Agenda · 6 Allievi ·
7 dettaglio guida · 8 Road · 9 Disponibilità · 10 Tu · 11 Ore di guida · 12 Il
mio gruppo · 13 Pagellino. Originali Gemini e prompt in
`/tmp/hiro-anteprime/memorabile/icone/`.

**Correzioni di Tiziano al passo 2** («perfetto», 28/10): (1) via TOTALMENTE il
blocco guide obbligatorie dal dettaglio allievo (né trofeo, né barra, né «6 di
6»); (2) salvadanaio sulla riga Pagamenti a 46 pt.

**Scostamenti dal piano**: niente mazzo di chiavi 3D (Road non ha uno stato vuoto
che lo giustifichi: meno icone); Road tiene la miniatura di mappa quando la
guida ha un percorso vero, l'auto 3D solo senza percorso; Allievi senza guide
future né da pagare tiene il contatore guide. Nessuna icona nuova oltre ai due
salvadanai. «Tutto saldato» catturato forzando solo il riepilogo in locale
(nessun allievo in pari; niente scritture su prod).

Feedback di partenza (Tiziano, 28/10/2026): le schermate sono corrette ma
**asettiche** (es. il foglio Pagamenti appena rifatto): non aiutano a capire
subito cosa fare e non rendono simpatico l'uso. Vanno rese più memorabili senza
essere pacchiane; la vita va **dosata per importanza** (design-system §0.2):
sezioni chiave più cura e più 3D, secondarie meno, mai la stessa dose ovunque.

Regole che valgono sempre: bianco puro/nero, niente pillole/badge/eyebrow,
animazioni sobrie senza rimbalzo (mai spente da Riduci movimento), premium
nativo, 3D solo dove porta informazione o vita (§0.9). Niente merge/push/OTA
senza l'ok di Tiziano.

Catture dello stato di partenza (prod, 28/10 pomeriggio):
`/tmp/hiro-anteprime/memorabile/oggi/` (00 Agenda · 01–04 Road, Allievi, Tu ·
10–12 dettaglio allievo · 20–21 Pagamenti · 30–35 impostazioni allievo, Il mio
gruppo, Nuovo, Disponibilità, Notifiche · 40–47 dettaglio guida, Ore di guida,
Veicoli, Luoghi, Pagellino, Aspetto, Impostazioni · 50–52 Road scorsa, Allievi
Tutti, Agenda).

Le quattro leve, per ogni schermata: **(a)** micro-copy caldo che guida
all'azione · **(b)** hero/stato riassuntivo · **(c)** stato vuoto illustrato ·
**(d)** momento di gioia · più, solo dove serve, **(e)** un'icona 3D.

---

## Classifica per importanza

| Peso | Schermate |
|---|---|
| Alto | Agenda · Road · Dettaglio allievo · Foglio «Nuovo» · Disponibilità · Tu |
| Medio | Pagamenti (alto per l'azione: soldi da riscuotere) · Allievi · Dettaglio guida · Il mio gruppo · Ore di guida · Notifiche |
| Basso | Veicoli · Luoghi · Pagellino · Aspetto agenda · Impostazioni · foglio Impostazioni allievo · fogli di modifica e picker |

---

## Pagamenti (foglio) — l'esempio guida, si fa per primo

**Oggi:** «3 guide da pagare» nudo sopra il segmentato; la casella non dice
cosa fa; si apre su «Tutte»; i mesi vecchi sono pieni di righe grigie
(«Programmata», «A credito», «Esame») che coprono le poche da riscuotere.

- (b)+(e) **Hero**: salvadanaio 3D (nuovo) a destra, numero grande «3» + «guide
  da pagare», sotto in grigio la più vecchia («la più vecchia è di gio 1 ott»).
- (a) **Frase che guida**: «Spunta la casella quando Serena ti paga» (nome
  dell'allievo, solo se c'è qualcosa da pagare e la guida si può segnare).
- (d) **Gioia**: spuntata l'ultima, l'hero passa in dissolvenza (niente
  rimbalzo) a «Tutto saldato» + «Serena è in pari» col salvadanaio **pieno**,
  haptic `success`. Aprendo un allievo già in pari si vede direttamente quello.
- **Si apre su «Da pagare»** se ce ne sono (altrimenti «Tutte»).
- (c) **«Da pagare» vuoto**: salvadanaio pieno + «Niente da riscuotere».
- **Mesi vecchi** (prima del mese scorso) senza guide da pagare: piegati in
  una riga «Mostra agosto e prima» in fondo, che li apre.
- Modalità sola lettura (incassa l'autoscuola): hero con la frase che lo dice,
  niente salvadanaio, niente frase-azione.

## Peso alto

### Agenda
**Oggi:** saluto con l'ora, card «Oggi 6 guide · Tutte fatte, buon resto di
giornata» col calendario 3D, griglia. Buona; la card però è statica.
- (a)+(b) La card «Oggi» segue la giornata: prima della prima guida «Prima
  guida alle 9:00 con Marco»; durante «Ora con Marco, finisce alle 10:00»; tra
  due guide «Prossima alle 12:00 con Simone»; a giornata finita «Domani 4
  guide, la prima alle 8:30» (se domani c'è lavoro).
- (d) A giornata finita l'oggetto 3D cambia (espresso, già in `MORALE_ART`).
- Griglia e testata fissa non si toccano.

### Road
**Oggi:** «Con chi guidi?» con i volti e «Parti con» sono vivi; «Ultime guide»
ha miniature della mappa minuscole e tutte uguali (si legge «Legal»), frecce
rosse «↑ 1» non chiare.
- (e) Miniature → auto 3D dall'alto/3/4 nel colore del veicolo della guida.
- (a) «↑ 1» → a parole: «1 da ripassare» / «1 superata».
- (c) Giornata senza allievi: «Nessuno in programma: scegli un allievo e
  parti» (facoltativo: mazzo di chiavi 3D nuovo).

### Dettaglio allievo
**Oggi:** volto grande, tre statistiche 3D, barra «Guide obbligatorie 6 di 6»,
righe Pagamenti/Impostazioni (con tre mini-icone), pagellino, storico guide con
«Aggiungi dettagli» su ogni riga.
- (a) Riga «cosa fare» sotto il nome, in grigio, una sola: «Prossima guida gio
  30 · 10:00»; senza guide future «Nessuna guida in programma».
- (d) Obbligo completato: «Ha fatto tutte le 6 guide obbligatorie» con il
  trofeo 3D piccolo (già in `MORALE_ART`) al posto della barra piena.
- (a)+(e) Riga Pagamenti: «3 guide da pagare» in nero 600 + salvadanaio 40 pt;
  in pari «In pari» grigio, salvadanaio pieno.
- Via le tre mini-icone dalla riga Impostazioni (dose: troppa roba).
- «Aggiungi dettagli» su ogni guida dello storico → resta solo l'icona matita.

### Foglio «Nuovo»
Già giusto (cartina Road + auto, oggetti 3D liberi). **Nessun cambio.**

### Disponibilità
**Oggi:** foto della sede, settimana a barre, righe per giorno.
- (b) Numero protagonista nella card: «38 h a settimana».
- (a) Giorni chiusi a parole nella lista («Sabato · chiuso»).

### Tu
**Oggi:** ore del mese con barre, lista impostazioni, «Esci».
- (a) Frase di confronto sotto le ore: «2 h in più di settembre» (o «come
  settembre»), mai un giudizio negativo («meno di…» → si omette).

## Peso medio

### Allievi
**Oggi:** lista pulita, seconda riga «6 di 6 · obbligo completato».
- (a) Seconda riga = il prossimo passo: «Giovedì alle 10:00», oppure «3 guide
  da pagare» in nero 600; il conteggio obbligo solo se nient'altro.
- (b) In cima, striscia di volti «Guidano con te questa settimana» (foto e
  iniziali, niente 3D).

### Dettaglio guida
**Oggi:** anello «4/6» senza etichetta, righe, «Correggi esito».
- (a) Etichetta sotto l'anello: «4ª guida di 6 obbligatorie».
- (a)+(e) Guida finita senza voto: riga calda «Com'è andata Marco?» con la
  stella 3D (già in `VITA_ART`) che apre il pagellino, sopra «Correggi esito».

### Il mio gruppo
Già con oggetti 3D sulle righe. (a) Sul codice d'invito: frase «Dallo ai nuovi
allievi: entrano già nel tuo gruppo» + azione «Condividi» (share sheet nativo).

### Ore di guida
(a) Confronto con la settimana prima sotto il numero, come in Tu.

### Notifiche
Stato vuoto «Sei in pari» con aeroplanino: già giusto. Nessun cambio.

## Peso basso (niente 3D nuovo)

- **Veicoli, Luoghi**: già con auto 3D / foto (portano informazione). Stati
  vuoti con frase se mancano.
- **Pagellino**: le 5 stelle gialle ripetute su ogni voce → una sola nota
  grigia «Ogni voce si valuta da 1 a 5 stelle».
- **Aspetto, Impostazioni, Impostazioni allievo**: come sono.

## Icone nuove (Gemini, metodo §0.9)

1. **Salvadanaio** — normale (Pagamenti hero, riga del dettaglio allievo).
2. **Salvadanaio pieno** — stessa forma, monete che spuntano dalla fessura
   (tutto saldato, «Da pagare» vuoto).
3. Facoltativa, giro Road: mazzo di chiavi auto (stato vuoto Road).

## Ordine dei giri

1. Pagamenti + dettaglio allievo (+ salvadanai) → anteprime prima/dopo.
2. Agenda + Allievi + Dettaglio guida.
3. Road (auto nelle ultime guide).
4. Disponibilità, Tu, Ore di guida, Il mio gruppo, Pagellino.
