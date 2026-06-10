# Reglo Mobile — Rebranding Specification

> Questo documento descrive OGNI schermata, sezione, elemento, stato, modale e variazione dell'app mobile Reglo.
> Usalo come riferimento completo per ridisegnare l'intera app senza tralasciare nulla.

---

## App Overview

**Reglo** e' un'app per la gestione di autoscuole (driving schools). Serve 3 ruoli utente con UI distinte:
- **Allievo (Student)** — prenota guide, paga, vede note, scambia lezioni
- **Istruttore (Instructor)** — gestisce agenda, disponibilita', note, ore
- **Titolare (Owner)** — visione d'insieme, gestione istruttori, veicoli, esami

L'app usa tab bar condizionale: alcune tab appaiono solo per certi ruoli.

---

## Struttura Navigazione

### Tab Bar (condizionale per ruolo)
| Tab | Icona | Visibile a | Schermata |
|-----|-------|------------|-----------|
| Home | house | Tutti | Home role-specific |
| Gestisci | calendar | Instructor, Owner | Agenda/calendario |
| Allievi | people | Instructor, Owner | Note allievi + cluster settings |
| Pagamenti | wallet | Student (se autoPayments) | Pagamenti |
| Sostituzioni | swap-horizontal | Student (se swap enabled) | Offerte scambio |
| Altro | ellipsis-horizontal | Tutti | Menu extra |
| Impostazioni | settings | Tutti | Settings |

### Flusso Auth
`Login → (Signup) → Company Select → Home`

Con invite link: `Invite Accept → Home`

---

## 1. SCHERMATE AUTH

### 1.1 Login
- **Hero**: Immagine duck mascotte + logo "Reglo"
- **Form**:
  - Input email (placeholder: "Email")
  - Input password (placeholder: "Password", secure entry)
  - Messaggio errore (condizionale, rosso)
  - Bottone "Accedi" (rosa, full width) — stato loading: "Accesso..."
- **Footer**: "Non hai un account?" + link "Iscriviti"

### 1.2 Signup
- **Hero**: Immagine duck + logo "Reglo"
- **Form**:
  - Input nome (placeholder: "Nome Cognome")
  - Input email (placeholder: "Email")
  - Input telefono (placeholder: "Numero di telefono")
  - Input codice scuola (placeholder: "Codice scuola", monospace, uppercase, max 6 char)
  - Input password (placeholder: "Password", secure)
  - Input conferma password (placeholder: "Conferma password", secure)
  - Messaggio errore (condizionale)
  - Bottone "Iscriviti" (rosa, full width) — loading: "Iscriviti..."
- **Footer**: "Hai gia' un account?" + link "Accedi"

### 1.3 Company Select
- **Saluto**: "Ciao {nome}"
- **Lista aziende**: Card con bottone per ogni azienda associata — loading per-bottone: "Seleziono..."
- **Errore**: Messaggio condizionale
- **Bottone logout** (danger style, in basso)

### 1.4 Invite Accept
- **Contesto invite**: Nome azienda + email utente
- **Stato account**: "Gia' membro" o "Account da creare"
- **Form condizionale**:
  - Se requiresPhone: dropdown prefisso (+39/+41/+33/+34/+49/+44) + input telefono
  - Se no account: input password + conferma password
- **Bottone "Accetta invito"** (rosa) — loading: "Accetto..."
- **Errore**: Messaggio condizionale

### 1.5 Role Blocked
- Messaggio: "Ruolo non supportato"
- Bottone logout

---

## 2. SCHERMATE STUDENT (Allievo)

### 2.1 Home Allievo (`AllievoHomeScreen`)

#### Header
- Saluto: "Ciao, {nome} 👋"
- Sottotitolo: "Pronto per la tua prossima guida?"
- Campanella notifiche (angolo destro) con badge contatore

#### Banner Priorita' Esame (condizionale: se esame entro 14 giorni)
- Gradiente viola (#8B5CF6 → #A78BFA)
- Icona 📋 + "Esame di guida" + data esame + pill "tra X giorni"
- Sottotesto: "Hai la priorita' per prenotare piu' guide"

#### Banner Bloccato da Priorita' (condizionale: se altri hanno priorita')
- Sfondo viola chiaro (#F5F3FF), bordo viola
- Icona lucchetto + "Prenotazioni temporaneamente bloccate"
- Spiegazione: "Altri allievi hanno la priorita' esame..."

#### Card Prossima Guida (condizionale: se nextLesson esiste)

**Variante A — Guida singola:**
- Card gradiente giallo (#FACC15 → #FDE68A)
- Immagine duck (duck-peek.png) in alto a destra
- Badge stato "IN CORSO" (se in progress, con dot verde pulsante)
- Label: "PROSSIMA GUIDA"
- Data/ora: "{giorno} • {ora}"
- Dettagli: iniziali istruttore + (se veicoli enabled) nome veicolo
- Bottoni azione (se non in corso e non esame):
  - "🤝 Cerca sostituto" (se swap enabled)
  - "❌ Annulla" (rosso)

**Variante B — Guide multiple nello stesso giorno:**
- Stessa card gialla ma label "PROSSIME GUIDE"
- Lista guide con orario, istruttore, veicolo per ciascuna
- Stessi bottoni azione per ciascuna (se applicabile)

**Variante C — Esame:**
- Gradiente indaco (#6366F1 → #A5B4FC) invece di giallo
- Icona scuola invece di duck
- Label: "ESAME DI GUIDA"
- Nessun bottone azione

#### Riga Istruttore Assegnato (condizionale: se studente in cluster con istruttore)
- Cerchio avatar rosa + icona persona
- "Il tuo istruttore" + nome
- Bottoni: WhatsApp (verde #25D366) + Chiama (blu #3B82F6)

#### CTA Assenza Settimanale (condizionale: se weeklyAbsenceEnabled)
- Se non dichiarata: sfondo giallo (#FFFBEB), "Assente questa settimana"
- Se dichiarata: sfondo rosso (#FEF2F2), "Annulla assenza settimanale"

#### Bottone CTA Principale (sempre visibile)
- "Prenota nuova guida" (rosa #EC4899, full width)
- **Stati disabilitati con testo specifico**:
  - Bloccato da insolvenze: "Salda ora"
  - Metodo pagamento richiesto: "Prenota nuova guida" (disabilitato)
  - Crediti esauriti: "Crediti guida esauriti"
  - Limite settimanale: "Limite di X guide settimanali raggiunto"
  - Prenotazione disabilitata da policy: non visibile

#### Calendario Orizzontale
- Label mese: "Gennaio 2026"
- Icona calendario (apre CalendarDrawer)
- Scroll orizzontale di pill giornalieri:
  - Formato: abbreviazione giorno (LUN/MAR/...) + numero
  - **Stili**:
    - Oggi: sfondo bianco, testo rosa
    - Selezionato (non oggi): sfondo rosa, testo bianco
    - Festivita': sfondo grigio, dot rosso
    - Esame: sfondo celeste, bordo blu
    - Con prenotazione: dot giallo/rosa
    - Non selezionato: sfondo chiaro, testo grigio

#### Sezione Agenda (lista guide nel periodo selezionato)
- Titolo: "Agenda"
- Max 4 visibili, poi "Mostra di piu'" / "Mostra meno"
- **Riga guida**:
  - Orario + badge stato
  - Istruttore: "Istruttore: {nome}"
  - (se veicoli) Veicolo: "Veicolo: {nome}"
  - (se pagamento) Pagamento: "Pagamento: {stato} • Residuo € {importo}"
  - Bottone "Dettagli"
- **Riga esame**:
  - Icona scuola + data/ora + badge "ESAME"
  - "Esame di guida" + "Con {istruttore}" o "Accompagnatore da assegnare"

#### Stati vuoti
- **Nessun profilo collegato**: duck-zen.png + "Profilo allievo non collegato"
- **Nessuna guida prenotata (giorno normale)**: duck + "Nessuna guida prenotata" + hint prenotazione
- **Festivita'**: icona rossa + "Giorno festivo" + "L'autoscuola e' chiusa"
- **Nessuna guida nel periodo**: "Nessuna guida nel periodo selezionato."

#### Stato Loading
- Skeleton card "Prossima guida" (3 blocchi)
- Skeleton CTA
- Skeleton calendario (mese + 5 pill)
- Skeleton agenda (2 righe)

#### BottomSheet: Dettaglio Guida
- Titolo: "Dettaglio guida"
- Card hero: data • ora + pill stato + durata
- Righe con icone colorate circolari:
  - Istruttore (cerchio blu + icona persona): nome o "Da assegnare" + telefono cliccabile
  - Veicolo (cerchio giallo + icona auto): nome o "Da assegnare"
  - Pagamento (cerchio rosa + icona portafoglio): stato + residuo
- Bottoni azione (solo per guide future confermate):
  - "🤝 Cerca sostituto" (se swap enabled)
  - "❌ Annulla guida" (rosso)

#### BottomSheet: Prenotazione
- Titolo: "Prenota guida" + (se crediti) badge "Crediti: X"
- **Sezione GIORNO**: card con data + icona calendario (apre CalendarDrawer)
- **Sezione DURATA**: chip singolo (se 1 sola) o chip multipli (30/45/60/90/120 min)
- **Sezione TIPO GUIDA** (se lesson policy enabled): chip multi-select (Manovre, Urbano, Extraurbano, Notturna, Autostrada, Parcheggio, Altro)
- **Sezione ISTRUTTORE**:
  - Se locked: chip singolo readonly + "Istruttore assegnato dal tuo cluster"
  - Se selezionabile: chip "Tutti" + chip per istruttore disponibile
- **Footer**: warning "Nessuna disponibilita'" (se non disponibile) + bottone "Prenota →"

#### BottomSheet: Scegli Orario
- Titolo: "Scegli un orario"
- Sottotitolo: "{data} • {durata} min"
- Timeline scroll di slot:
  - Ora a sinistra + card orario (es. "14:00 - 15:00")
  - Se selezionato: sfondo rosa + checkmark
- Footer: "Prenota" (disabilitato se nessuno selezionato)

#### Animazione Celebrazione
- Overlay con confetti dopo prenotazione riuscita
- Variante "booking"

#### Toast
- "Guida prenotata" (success)
- "Scambio confermato!" (success)
- "Guida annullata dall'autoscuola" (info)
- "Slot non piu' disponibile" (danger)
- "Nessuna disponibilita' per il giorno scelto" (info)
- "Pagamento completato" (success)

---

### 2.2 Pagamenti Allievo (`AllievoPaymentsScreen`)

#### Header
- Titolo: "Pagamenti"

#### Card Hero (gradiente giallo)
- Label: "Totale transazioni"
- Importo: "€ {totale}"
- Meta: "{N} movimenti • {N} riusciti • {N} falliti"

#### Lista Transazioni
- **Loading**: 4 righe skeleton
- **Vuoto**: duck-coins.png + "Nessuna transazione" + "I tuoi movimenti appariranno qui"
- **Riga transazione**:
  - Quadrato icona (40x40): sfondo giallo se success + 3 lettere fase / sfondo rosa se errore + "ERR"
  - Titolo: label fase (ACCONTO, SALDO, BONIFICO...)
  - Data/ora
  - (se fallito) "Pagamento fallito" (rosso)
  - Importo: "€ {importo}"
- **"Carica altre"** se ci sono piu' pagine

#### BottomSheet: Dettaglio Transazione
- Card hero (sfondo grigio chiaro):
  - Titolo: "{fase} • € {importo}"
  - Pill stato colorata
  - Data/ora
  - (se fallito) messaggio errore in rosso
- **Sezione GUIDA COLLEGATA** (righe con cerchi colorati):
  - Calendario (giallo): data/ora
  - Istruttore (blu): nome
  - Veicolo (giallo): nome
  - Stato guida (verde): stato
- **Sezione PAGAMENTO**:
  - Stato (rosa): label stato
  - Importi (rosa): "Dovuto € X • Pagato € Y • Residuo € Z"
  - Fattura (rosa): stato fattura + tentativi
- **Footer**: "Condividi" (outline) + "Visualizza" (dark)

---

### 2.3 Sostituzioni (`SwapOffersScreen`)

#### Header
- Titolo: "Sostituzioni 🔄"
- Sottotitolo: "Qualcuno ha bisogno di un sostituto? Dai un'occhiata! 👀"

#### Loading
- Spinner grande centrato

#### Vuoto
- Emoji "😴" grande
- "Nessuna richiesta"
- "Quando qualcuno cerca un sostituto lo vedrai qui. Stay tuned! ✨"

#### Card Offerta (per ogni offerta)
- **Header**: cerchio avatar "🙋" + nome studente + "cerca un sostituto" + badge "🤝 Aperta" (verde)
- **Dettagli** (con emoji):
  - 📅 Data/ora
  - 👨‍🏫 Istruttore
  - 🚗 Veicolo
  - 📋 Tipo guida
- **Footer**: ⏰ "Rispondi entro le {ora}"

#### BottomSheet: Dettaglio Sostituzione
- Emoji "🙋" + nome + "cerca un sostituto per la guida"
- Card dettagli (sfondo grigio #F8FAFC): stessi campi con emoji
- Bottone "🤝 Accetta sostituzione" (rosa) — loading: "Attendi..."

#### Celebrazione
- Confetti variante "swap" dopo accettazione

#### Polling
- Auto-refresh ogni 30 secondi

---

### 2.4 Le Mie Note (`StudentMyNotesScreen`)

#### Header
- "Le mie note" + "Note rilasciate dai tuoi istruttori"

#### Loading
- 5 skeleton card

#### Vuoto
- Icona 📄 + "Nessuna nota" + "Le note rilasciate dagli istruttori dopo le guide appariranno qui."

#### Timeline
Per ogni guida con note:
- **Colonna sinistra**: data (es. "15 apr") + linea verticale connettrice
- **Colonna destra — Guida normale**: card bianca con bordo
  - Orario + badge tipo guida (sfondo blu, testo blu) + stelle rating
  - Icona 👤 + nome istruttore + (se veicolo) nome veicolo
  - Testo nota o "Nessuna nota" (grigio, italico)
- **Colonna destra — Esame**: card sfondo viola (#F5F3FF), bordo viola
  - Barra laterale viola 4px
  - Cerchio viola + icona scuola + "ESAME" + orario
  - Istruttore + nota

---

### 2.5 Dettaglio Note Studente (`StudentNotesDetailScreen`)

#### Header
- Bottone back + nome studente

#### Riga Contatto (se telefono disponibile)
- Icona telefono + numero
- Bottoni WhatsApp (verde) + Chiama (blu)

#### Card Progresso (Obbligo Guide)
- "OBBLIGO GUIDE" (label piccola grigia)
- Numeri grandi: "{completate}/{RICHIESTE}"
- Barra progresso orizzontale
- "Obbligo completato" o "Mancano X guide"

#### Card Prossimo Esame (condizionale)
- Cerchio viola + icona scuola + tipo esame + data

#### Riga Statistiche (3 box)
- "X Guide totali" + "X Completate" + "X Con note"

#### Bottone Storico Guide (espandibile)
- "Vedi storico guide" / "Nascondi storico guide" + chevron animato

#### Timeline Guide (quando espanso)
- Stessa struttura di StudentMyNotesScreen ma con TUTTE le guide
- Animazione staggered FadeInDown
- Vuoto: "Nessuna guida registrata con questo allievo."

---

## 3. SCHERMATE INSTRUCTOR (Istruttore)

### 3.1 Home Istruttore (`IstruttoreHomeScreen`)

#### Header
- "Ciao, {nome} 👋" + "Gestisci le tue guide"
- Toggle scope (se INSTRUCTOR_OWNER): "Le mie guide" / "Tutti gli istruttori"

#### Banner Lezione in Evidenza
- Se guida in corso: "In corso" (sfondo giallo/rosa, dot pulsante)
- Se prossima guida: "Prossima" + giorno/ora + nome studente

#### Banner Alert
- Banner arancione "out of availability": conteggio + "Gestisci"
- Banner rosso errore caricamento

#### Calendario Pill Giornalieri
- Label mese + icona ↩️ (oggi) + icona 📅 (calendar picker)
- Scroll orizzontale di pill:
  - Formato: abbreviazione giorno + numero data
  - **Stili**: oggi (giallo), selezionato (rosa), festivita' (grigio + dot rosso), con prenotazione (dot rosa), con esame (dot blu), malattia (dot arancione)

#### Griglia Timeline
- Label ore: "07:00", "08:00", ... "21:00"
- Strisce disponibilita' (linea rosa sul bordo sinistro per ore disponibili)
- "Non disponibile" centrato per ore senza disponibilita'
- **Linea "Now"**: linea orizzontale animata che indica l'ora corrente (solo oggi)

#### Blocchi Appuntamento (nel timeline)
Tutti i blocchi hanno: bordo sinistro 4px colorato per stato + info

**Per stato:**
- **Pending Review**: bordo arancione, sfondo arancione, "In revisione"
- **Checked In**: bordo rosa, sfondo rosa, "In corso", animazione pulsante
- **Completed**: bordo verde, sfondo verde, "Completata"
- **No Show**: bordo grigio, sfondo grigio, "Assente"
- **Cancelled**: bordo grigio, sfondo grigio, "Annullata"
- **Proposal**: bordo viola, sfondo viola, "Proposta"
- **Scheduled**: bordo giallo, "Programmata" o "Obbligatoria"
- **Exam**: bordo indaco, sfondo indaco, badge "ESAME", icona scuola

**Dimensioni blocco:**
- Compatto (<55px): riga singola: icona + ora + nome studente abbreviato
- Normale (55-110px): orario + badge stato + nome + meta
- Pieno (≥110px): tutti i dettagli espansi + tipi lezione + note

#### Blocchi Esame Gruppo
- Raggruppati per orario/istruttore
- "Esame · N allievi" + nomi studenti

#### Blocchi Istruttore (malattia, blocchi manuali)
- Sfondo arancione (#FFF7ED), bordo arancione (#FED7AA)
- Testo motivo se presente

#### Stati Vuoti
- **Malattia giornata intera**: card grande con icona medkit + "In malattia" + badge date + "Rimuovi malattia"
- **Malattia parziale**: banner inline con orario + "Rimuovi malattia"
- **Festivita'**: icona rossa + "Giorno festivo" + "L'autoscuola e' chiusa"
- **Nessun appuntamento**: duck-zen.png + "Nessuna guida oggi" + "Giornata libera"
- **Loading**: 6 skeleton card

#### BottomSheet: Dettaglio Lezione
- **Header**: bottone back/close + badge stato colorato
- **Card Studente**: avatar + nome + telefono + minuti completati
- **Info Appuntamento**: data/ora + badge durata + veicolo + chip tipo lezione (selezionabili)
- **Rating**: stelle 1-5 (input)
- **Note**: textarea editabile
- **Ultima nota studente**: blocco citazione (se disponibile)
- **Azioni** (condizionali per stato/orario):
  - "Conferma (checked_in)" — check in
  - "Assente (no_show)" — segna assente
  - "Salva dettagli" (se modificati)
  - "Riposiziona" (guide future)
  - "Riprogramma" (stati validi)
  - "Annulla guida" (modale-dependent: cancel manuale o reposition)
  - "Scambia con..." (se swap enabled)

#### BottomSheet: Prenotazione Guida
**3 modalita'**: form | calendario | time picker

**Form**:
- Selezione studente: SearchableSelect (se cluster: "I miei allievi" + "Altri allievi")
- Selezione veicolo: chip row (se veicoli enabled)
- Chip tipo lezione: multi-select
- Chip durata: 30/45/60/90/120 min
- Bottone "Suggerisci" → card slot suggerito
- Picker data + picker ora

**Calendario**: MiniCalendar embedded + duck mascotte + date con dot

**Time Picker**: colonne ore (0-23) + minuti (0/15/30/45) + conferma

**Footer**: "Prenota guida" o "Prenota N guida/e" (multi-booking)

**Multi-booking mode**: entries multiple con data/ora/durata, edit/delete per entry

#### BottomSheet: Creazione Blocco
- Picker data + picker ora inizio + picker ora fine
- Textarea motivo (opzionale)
- Toggle "Ricorrente?" → chip settimane (2/4/8/12)

#### BottomSheet: Out of Availability
Per ogni appuntamento conflitto:
- Card appuntamento: studente, data/ora, tipo
- 3 bottoni: "Annulla" (rosso) + "Riposiziona" (blu) + "Mantieni" (verde)

#### BottomSheet: Dettaglio Esame Gruppo
- Header: orario + istruttore + note
- Lista studenti con checkbox + "Rimuovi da esame"
- "Annulla esame" (distruttivo)

#### BottomSheet: Dettaglio Cluster (vista tutti istruttori)
- Lista appuntamenti sovrapposti raggruppati per istruttore

#### Modale Scambio (centrata)
- SearchableSelect studenti
- Lista candidati filtrati (stesso istruttore, data futura, schedulati)
- Raggruppati per giorno, tap per confermare con Alert

#### Quick Book (Drag-to-create)
- Blocco trascinabile sul timeline
- Handle superiore (sposta inizio, step 15 min) + handle inferiore (resize durata)
- Selezione studente + toggle tipo (lezione | blocco)
- "Prenota" / "Blocca" per confermare

---

### 3.2 Gestione Istruttore (`InstructorManageScreen`)

#### Tab Disponibilita'
**3 tab segmented control**:

**Tab 0 — Predefinito (default weekly)**:
- "GIORNI LAVORATIVI": 7 cerchi giorno (D/L/M/M/G/V/S) — attivo giallo, inattivo grigio
- "FASCE ORARIE": RangesEditor (card con ora inizio-fine, bottone rimuovi, bottone +aggiungi)
- "Salva disponibilita'"

**Tab 1 — Calendario (override giornalieri)**:
- MiniCalendar con date marcate (dot)
- Accordion dettaglio giorno (animato):
  - Label giorno + badge "Override attivo" o "Assente"
  - RangesEditor (se non assente)
  - "Salva orario personalizzato"
  - "Segna come assente" (rosso)
  - "Ripristina predefinito" (se override)

**Tab 2 — Ricorrente**:
- 7 cerchi giorno selezione
- Checkbox "Assente tutto il giorno"
- RangesEditor (se non assente)
- Chip settimane: 2/4/8/12
- "Salva override ricorrente" o "Segna assente ogni..."

#### Tab Veicoli
- Lista card veicoli (emoji + nome + targa + badge attivo/inattivo)
- "Aggiungi veicolo" (giallo, plus)
- Vuoto: "Nessun veicolo"
- BottomSheet edit: info box + toggle stato + cerchi giorno disponibilita' + time picker

#### Tab Prenotazioni (se autonomousMode)
- "Impostazioni prenotazione" + "Configura come i tuoi allievi possono prenotare le guide"
- Chip durata: 30/45/60/90/120 min
- Toggle "Solo orari tondi"
- "Salva impostazioni"

---

### 3.3 Disponibilita' (`InstructorAvailabilityScreen`)

#### Dispatcher
- Se `availabilityMode === "default"`: mostra AvailabilityEditor (stessi 3 tab di InstructorManageScreen)
- Se `availabilityMode === "publication"`: mostra PublicationModeEditor
- Loading: 3 skeleton card

---

### 3.4 Publication Mode Editor (`PublicationModeEditor`)

#### Navigazione Settimana
- Frecce sinistra/destra (cerchi con chevron)
- Label range settimana: "1 – 31 gen"
- Pill stato: "Pubblicata" (verde #F0FDF4 + dot verde) o "Bozza" (giallo #FEFCE8 + dot giallo)

#### Striscia Giorni (orizzontale)
- 7 pill (L/M/M/G/V/S/D)
- Ogni pill: lettera + numero data
- **Stili**: disponibile (rosa #EC4899, testo bianco), non disponibile (grigio #F1F5F9), selezionato (bordo evidenziato), oggi (bordo highlight)

#### Pannello Dettaglio (animato)
- **Header**: nome giorno + data + toggle disponibile/non disponibile
- **Se disponibile**: RangesEditor (fasce orarie editabili)
- **Se non disponibile**: icona luna + "Non disponibile"

#### CTA Pubblica/Ritira
- "Pubblica settimana" (primary rosa) se bozza
- "Ritira pubblicazione" (danger) se pubblicata

---

### 3.5 Note Istruttore (`InstructorNotesScreen`)

#### Header
- "Allievi" (grande, bold)
- Pill settings (se autonomousMode): icona ingranaggio in cerchio
- Pill ricerca (morphing): cerchio 48x48 → espande a full width + input + bottone chiudi

#### Lista Studenti
- Se cluster attivi: SectionList con "I miei allievi" (count) + "Altri allievi" (count)
- Se no cluster: FlatList tutti
- **Card studente**: cerchio avatar (iniziali, colore da hash ID) + nome + "N guida/e" + telefono + chevron

#### Ricerca (overlay)
- Backdrop semi-trasparente
- Card risultati: input + chiudi + lista (max 8) + vuoto: "Nessun risultato"

---

### 3.6 Ore Istruttore (`InstructorHoursScreen`)

#### Header
- Back + "Ore di guida"

#### Navigazione Settimana
- Chevron sinistra/destra + "Questa settimana" o "1 – 31 gen"

#### Card Riepilogo (primary)
- Numero grande: "Xh Ym" (totale minuti)
- "questa settimana"
- Badge ore fuori orario (giallo, se presenti)

#### Grafico Barre Giornaliero
- 7 colonne (L/M/M/G/V/S/D)
- Barre animate (altezza relativa al max)
- Label valore in cima (se non vuoto)
- Colore: rosa se in orario, ambra se fuori orario
- Label giorno sotto

#### Card Riepilogo Mensile
- "Mese: Xh Ym" + "di cui X fuori orario" (se presenti)

#### Info Orario Lavorativo
- Icona orologio + "Orario di lavoro: HH:MM–HH:MM"

#### Stati Vuoti
- "Errore nel caricamento" (card rossa)
- "Nessuna guida completata" (card grigia)

---

### 3.7 Impostazioni Cluster (`ClusterSettingsScreen`)

#### Header
- Back + "Il mio gruppo"
- Sottotitolo: "Configura come i tuoi allievi possono prenotare le guide con te."

#### Card Allievi
- "Allievi del gruppo" + conteggio o "Non hai ancora aggiunto allievi"
- "Gestisci" (pill rosa, icona edit)
- Se nessuno: "Aggiungi allievi al gruppo" (bordo tratteggiato)
- Se presenti: stack avatar sovrapposti (max 6 + badge "+N")

#### 3 Accordion (con chevron)

**Accordion 1 — Prenotazione guide**:
- Riepilogo: "Solo allievi · 30/60 min"
- "Chi prenota": 4 chip (Default / Solo allievi / Solo istruttori / Entrambi)
- "Modalita' istruttore": 3 chip (Default / Manuale totale / Manuale + motore)
- "Durata guide": 5 chip (30/45/60/90/120 min)
- "Solo orari tondi": toggle + descrizione

**Accordion 2 — Limiti e orari**:
- Riepilogo: "Nessun limite attivo" o "Cutoff 18:00 · Max 3/sett. · Fascia 08:00-13:00"
- "Cutoff prenotazione": toggle + time picker
- "Limite settimanale": toggle + chip (1/2/3/4/5/7/10)
- "Fascia oraria ristretta": toggle + 2 time picker (inizio/fine)

**Accordion 3 — Funzionalita' extra**:
- Riepilogo: "Nessuna attiva" o "Scambio · Assenza"
- "Scambio guide": toggle + descrizione
- "Assenza settimanale": toggle + descrizione

#### Bottone Salva
- "Salva impostazioni" (rosa, full width, fondo pagina)

#### BottomSheet: Gestione Allievi
- Header: "Allievi del gruppo" + badge conteggio (cerchio rosa)
- Riga ricerca: icona + input + bottone clear
- "Deseleziona tutti" (se selezioni attive)
- Lista: avatar + nome + sottotesto "Nel gruppo di un altro istruttore" (se assegnato altrove) + checkbox circolare (rosa quando selezionato)
- Vuoto: "Nessun allievo trovato"
- Footer: "Conferma" o "Conferma selezione (N)"

---

## 4. SCHERMATE OWNER (Titolare)

### 4.1 Home Titolare (`TitolareHomeScreen`)

#### Header
- Selettore data con frecce navigazione + data corrente
- Toggle vista giorno/settimana

#### Vista Giorno (Timeline)
- Timeline verticale ora per ora (6:00 – 20:00)
- Blocchi appuntamento colorati per stato (stessi colori dell'istruttore)
- Blocchi cluster quando 2+ appuntamenti nella stessa ora

#### Vista Settimana (`WeeklyAgendaView`)
- Griglia 6 giorni (Lun-Sab)
- Blocchi colorati per appuntamento

#### Banner Out of Availability (condizionale)
- Alert rosso quando ci sono conflitti istruttore/veicolo
- Conteggio conflitti + "Gestisci"

#### Gestione Festivita'
- Long-press su giorno per creare festivita'
- Nome opzionale (es. "Ferragosto")
- Opzione cancellare appuntamenti associati

#### FAB
- Bottone azione flottante per aggiungere appuntamento

#### BottomSheet: Dettaglio Appuntamento
- Studente, istruttore, veicolo, tipo, stato
- Azioni: Conferma, Riprogramma, Annulla, Completa

#### BottomSheet: Out of Availability
- Lista conflitti + opzioni: riassegna veicolo/istruttore

#### BottomSheet: Dettaglio Cluster
- Lista appuntamenti sovrapposti nella stessa ora

#### Modale Festivita'
- Date picker + durata + conferma

---

### 4.2 Gestione Istruttori (`OwnerInstructorScreen`)

#### Carosello Istruttori
- Scroll orizzontale card istruttore

#### Card Istruttore Selezionato
- Stats: lezioni oggi (totali/completate/prossime)

#### Tab Disponibilita'
- "Predefinito": 7 cerchi giorno + fasce orarie
- "Calendario": MiniCalendar + override giornalieri

#### Sezione Invito
- Input email + bottone invio

---

### 4.3 Gestione Veicoli (`OwnerVehiclesScreen`)

#### Lista Veicoli
- Card per veicolo: emoji + nome + targa + badge attivo/inattivo
- "Aggiungi veicolo" (FAB o bottone)

#### BottomSheet: Crea Veicolo
- Input nome (placeholder: "Fiat 500")
- Input targa (placeholder: "AB123CD")
- Bottone crea

#### BottomSheet: Modifica Veicolo
- Info (nome, targa)
- Toggle attivo/inattivo
- Cerchi giorno disponibilita' + card orario
- Time picker per inizio/fine
- Salva + Elimina

---

### 4.4 Creazione Esame (`CreateExamScreen`)

#### Header
- "Crea Esame" + back

#### Selezione Studenti
- Input ricerca
- Lista multi-select raggruppata per cluster ("Mio gruppo", "Altro gruppo", non assegnati)
- Stack avatar selezionati (max 6 + overflow "+N")
- Bottone deseleziona tutti

#### Selezione Data/Ora
- Card data + icona calendario → CalendarDrawer
- Card ora inizio/fine → TimePickerDrawer (default 1h)

#### Note
- Textarea opzionale

#### CTA
- "Crea Esame" (rosa, full width) — loading state

---

## 5. SCHERMATE CONDIVISE

### 5.1 Impostazioni (`SettingsScreen`)

#### Tutte i ruoli
- **Profilo**: avatar + nome + (espandibile) telefono + azienda
- **Password**: cambio password
- **Notifiche**: chip timing reminder (120m/60m/30m/20m/15m)
- **Danger zone**: Logout (rosso) + Elimina account (rosso)
- **Modale conferma eliminazione account**

#### Solo Student
- **Disponibilita'**: cerchi 7 giorni + toggle mattina/pomeriggio
- **Metodo pagamento** (se auto-payments): card Stripe o "Nessun metodo" + aggiungi/modifica

#### Solo Instructor
- **Disponibilita'**: toggle modo "Predefinita" vs "Pubblicazione" + link gestione
- **Autonomia, durate, orari tondi**

#### Solo Owner
- **Vista agenda**: chip giorno/settimana + chip settimane avanti (2w/4w/6w/8w/12w)
- **Reminder**: chip per studenti + chip per istruttori
- **Booking actors, booking mode, swap toggle, cutoff, limiti**

---

### 5.2 Inbox Notifiche (`NotificationInboxScreen`)

#### Header
- Back + "Notifiche" + "Segna tutte" (condizionale, se unread)

#### Lista Notifiche (FlatList)
Per ogni notifica:
- Cerchio icona (sinistra) con icona per kind
- Titolo (es. "Sostituzione da {nome}", "Slot liberato")
- Sottotitolo (data/ora formattati)
- Timestamp relativo ("5 min fa", "ieri")
- Dot unread (destra, rosa #EC4899)
- Swipe destra → icona cestino + "Elimina" (sfondo rosso)

#### Icone e titoli per kind
| Kind | Icona | Titolo |
|------|-------|--------|
| waitlist | time-outline | "Slot disponibile" |
| swap / swap_offer | swap-horizontal-outline | "Richiesta sostituzione" |
| confirmation / swap_accepted | checkmark-circle-outline | "Sostituzione confermata" |
| proposal | document-text-outline | "Proposta guida" |
| available_slots | calendar-outline | "Slot disponibili" |
| holiday_declared | sunny-outline | "Giorno festivo" |
| weekly_absence | calendar-clear-outline | "Assenza settimanale" |
| sick_leave_cancelled | medkit-outline | "Fine malattia" |
| appointment_rescheduled | arrow-forward-circle-outline | "Guida spostata" |
| appointment_cancelled | close-circle-outline | "Guida annullata" |
| availability_published | megaphone-outline | "Disponibilita' pubblicate" |

#### Vuoto
- Icona notifications-off-outline + "Nessuna notifica"

---

### 5.3 Altro (`MoreScreen`)

#### Menu Items (condizionali per ruolo)
Ogni item: cerchio icona colorato + label + descrizione + chevron

| Item | Icona/Colore | Visibile a |
|------|-------------|------------|
| Veicoli | Giallo (#CA8A04 su #FEF9C3) | Owner (se vehiclesEnabled) |
| Panoramica Istruttori | Rosa (#EC4899 su #FCE7F3) | INSTRUCTOR_OWNER |
| Ore di Guida | Rosa (#EC4899 su #FCE7F3) | Instructor, INSTRUCTOR_OWNER |
| Impostazioni | Grigio (#64748B su #F1F5F9) | Tutti |

---

### 5.4 Notification Overlay (sempre attivo, montato sopra i tab)

Overlay always-on che gestisce le notifiche push in-app.

#### Campanella con Badge
- Icona campanella + badge contatore unread (angolo alto destro)
- Bolla "Hai N novita'!"

#### Drawer per Kind (BottomSheet condizionali)

**Swap Offer**:
- Hero: "{nome} vuole fare uno scambio"
- Card dettagli con emoji (calendario, studente, istruttore, veicolo)
- "Accetta" (verde) + "Rifiuta" (grigio)

**Swap Accepted**:
- "Affare fatto!" con animazione celebrazione
- Card dettagli appuntamento

**Waitlist Offer**:
- "Slot disponibile!" + dettagli slot
- "Prenota" per accettare + dismiss

**Proposal**:
- "Nuova proposta di guida"
- Dettagli data/ora/tipo
- "Accetta" + "Rifiuta"

**Available Slots**:
- Chip filtro durata (30m/60m/90m/120m)
- Lista slot scrollabile con data/ora/istruttore
- Tap per selezionare → conferma prenotazione
- Celebrazione al successo

**Tutti gli altri kind** (holiday, absence, sick leave, rescheduled, cancelled, published):
- Toast notification con messaggio appropriato

---

## 6. COMPONENTI CONDIVISI (Reference per Designer)

| Componente | Uso | Varianti |
|-----------|-----|----------|
| **Card** | Container generico | primary (radii 35), secondary (radii 16), tertiary (radii 16), dark |
| **Button** | CTA e azioni | primary (rosa), standard (bianco), danger (rosso bordo), secondary (giallo) |
| **Badge** | Etichette stato | default (rosa), success (verde), warning (giallo), danger (rosso) |
| **Input** | Campi testo | default (grigio), focused (bordo rosa) |
| **SelectableChip** | Toggle multi-scelta | inactive (grigio), active (giallo) |
| **BottomSheet** | Drawer modale | con handle (mai X), footer opzionale, drag-to-dismiss |
| **CalendarDrawer** | Picker data | griglia mese, duck mascotte, pill giorno |
| **TimePickerDrawer** | Picker ora | 2 colonne scroll, duck mascotte, CTA rosa |
| **MiniCalendar** | Calendario inline | dot indicatori, selezione giorno, navigazione mese |
| **RangesEditor** | Fasce orarie | pill bianche con ombra, cerchio orologio rosa, dashed add |
| **SectionHeader** | Titolo sezione | primary/secondary/tertiary + action pill opzionale |
| **ToastNotice** | Feedback temporaneo | success (verde), info (scuro), danger (rosso) |
| **BookingCelebration** | Celebrazione | "booking" (default), "swap" (rosa) |
| **StarRating** | Valutazione 1-5 | input (editabile), display (readonly) |
| **Skeleton** | Loading placeholder | block (rettangolo), card (card completa) |
| **Screen** | Wrapper SafeArea | tutte le schermate |

---

## 7. BRAND CORRENTE (per reference)

- **Rosa Brand**: #EC4899 (CTA, focus, tab bar, notifiche)
- **Giallo Accent**: #FACC15 (card prossima guida, chip attivi, today)
- **Regola 70/20/10**: 70% neutri, 20% rosa, 10% giallo
- **Mascotte**: Duck illustrations (duck-login, duck-zen, duck-coins, duck-clock, duck-calendar, duck-peek)
- **Radii**: 20px (controlli), 35px (card grandi), 999px (pill)
- **Font**: System default (no custom font)
- **Animazioni**: Spring-based (react-native-reanimated), stagger su liste, press scale su ogni interattivo
