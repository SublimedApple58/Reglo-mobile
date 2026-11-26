# REG-794 — App mobile del titolare «onnisciente»

## Cosa è stato fatto (aggiornato al 26/11/2026)

- **Rilascio 1, IN PROD il 26/11** (master `73fd300`, OTA doppia 2.4.2 e 2.4.0):
  - Agenda con il segmentato «La mia · Tutti»;
  - giorno della scuola a colonne-istruttore (concetto A, scelto da Tiziano);
  - settimana di un istruttore e fantasma per colonna;
  - via la settimana «Tutti».
  - Doc: `docs/features/giorno-della-scuola.md`.
- **Rilascio 2, commit locali sul branch `feat/reg-794-app-titolare`:**
  - «Oggi» come nelle anteprime O1/O1b/O2;
  - tab dei titolari Oggi · Agenda · [Road] · Allievi · Tu, campanella in testa a Oggi, Tu unificato;
  - parte mobile di REG-795: disponibilità di tutti da `agenda/availability` con ripiego sul 404, esame dal fantasma a nome dell'istruttore della colonna, titolare puro non più in sola lettura.
  - Doc: `docs/features/oggi-titolare.md`.
- **Hotfix IN PROD il 26/11** (master `66f28b4`, OTA doppia): tolto il bottone «Modifica disponibilità» del foglio vecchio, che perdeva gli orari per giorno.
- **Disponibilità «per conto di» (piano base M0–M6, approvato da Tiziano il 26/11; niente B3/B4), commit locali:**
  - M0: anteprime in `/tmp/hiro-anteprime/reg-794/disp/`, approvate con l'avviso prima del cambio di modalità e «Non disponibile» nell'elenco eccezioni;
  - M1–M2: «Disponibilità di Sara» = `InstructorAvailabilityScreen` con `instructorId`, modalità via B1 con il segmentato in testa;
  - M3: eccezioni su più giorni, «Non disponibile», «Altre N»;
  - M4: Assenze (malattia, ferie nuove su `instructor-vacation`, periodi eliminabili);
  - M5: accessi da Oggi e dall'orologio della settimana in Agenda; tolti il foglio vecchio, `OwnerInstructorScreen`, l'invito istruttore e la navigazione legacy (`App.tsx`, `index.ts`, `src/navigation`);
  - M6: provato su iOS, titolare puro contro staging, titolare-istruttore su dev (staging non ha titolari-istruttori). Android NON provato.
  - Fuori piano: l'invito Road del titolare-istruttore si apre in Oggi (prima saltava all'Agenda).
  - Backend B1+B2 (`fix/reg-794-availability-owner`, altro terminale) va in prod PRIMA dell'OTA.
  - Doc: `docs/features/availability-editor.md` (sezione «Per conto di»).

### Modifiche concordate durante il lavoro

1. Il titolare puro agisce sulle guide come sul web: l'audit backend è stato fatto in REG-795.
2. La settimana «Tutti» si toglie.
3. La rotta della disponibilità è nel suo worktree web (REG-795). Il mobile tiene il ripiego per i backend senza rotta.
4. Le notifiche del titolare restano fuori, in un task a parte.
5. Si rilascia in due tempi: prima l'Agenda, poi Oggi e le tab.
6. Concetto A per il giorno della scuola; «Oggi» così com'è nelle anteprime.
7. «Segna malattia o ferie» diventa «Segna malattia»; dal 26/11 la riga è «Assenze» (malattia e ferie) per un collega.
8. Tiziano (26/11): il titolare vede e modifica la disponibilità di OGNI istruttore con la stessa flessibilità del web → piano M0–M6 (ricognizione in `/tmp/hiro-anteprime/reg-794/ricognizione-disponibilita.md`).

### Resta da fare

- «Invita istruttore» non è più nell'app (era solo in `OwnerInstructorScreen`): resta sul web.
- Android da provare (serve una build di debug locale).
- Facoltativi B3 (luogo di una fascia dall'agenda) e B4 (serie di blocchi).
- QA su Android, ok di Tiziano e OTA doppia del rilascio 2. L'OTA può partire prima del backend in prod grazie al ripiego.

---

## Piano originale (fase 1, approvato il 26/11)

# REG-794 — App mobile titolare «onnisciente» · FASE 1: analisi e piano

> Solo analisi, niente codice. Worktree: `reglo-mobile-worktrees/reg-794` (branch `feat/reg-794-app-titolare`, pulito).
> Fonti: `docs/INDEX.md`, `impact-map.md`, `design-system.md` §0 e §6.20, `features/agenda-istruttore.md`, codice mobile; web `AutoscuoleAgendaPage.tsx` + API; screenshot di REG-763 (settimana «Tutti gli istruttori», illeggibile).

---

## 1. Ricognizione — com'è oggi

### 1.1 Tab per ruolo (mobile)

| Ruolo | Tab |
|---|---|
| **Titolare puro** (`OWNER`) | Home (= agenda dell'istruttore in `ownerMode`) · **Istruttore** (`OwnerInstructorScreen`, «I tuoi istruttori») · Allievi · Notifiche · Altro (se ci sono i veicoli, sennò Impostazioni) |
| **Titolare-istruttore** (`INSTRUCTOR_OWNER`) | La stessa barra dell'istruttore: Agenda · Road · Allievi · Tu. Le cose da titolare sono in Tu → «Panoramica istruttori» |
| **Istruttore** | Agenda · Road (se attivo) · Allievi · Tu |

Il ruolo arriva da `/api/mobile/me`. `isOwner` vale per OWNER e INSTRUCTOR_OWNER, `isInstructor` per INSTRUCTOR e INSTRUCTOR_OWNER (`src/utils/roles.ts`).

### 1.2 Problemi dell'agenda del titolare

- **Settimana con tutti gli istruttori nella stessa colonna del giorno.** Le corsie si dividono ~50 pt per colonna: su iPhone stanno ~3 corsie da 16 pt, con le iniziali («MA», «SE») e «+N». È esattamente lo screenshot di REG-763.
- **Il titolare puro è in sola lettura:**
  - niente «+»;
  - blocchi non tappabili;
  - fogli guida in `readOnly`: niente Sposta, Scambia, Elimina, Presente/Assente, cambio istruttore;
  - esami e gruppi in sola lettura.
  - Può però creare dal fantasma scegliendo l'istruttore (REG-671). Il doc dice ancora «niente fantasma»: è vecchio.
- **Per il titolare mancano:**
  - la card «Oggi»;
  - la tinta della disponibilità (calcolata solo per un istruttore, con 21 chiamate al giorno);
  - il colore degli istruttori (arriva dal bootstrap ma il mobile non lo usa).
- **Il titolare-istruttore** in «Tutti» crea sempre **per sé**, anche se sta guardando un collega. Inoltre la tinta della disponibilità e il banner «fuori disponibilità» sono solo i suoi.
- **Bug in `OwnerInstructorScreen`:** `loadData` passa l'istruttore selezionato. Così «In guida», «N guide oggi» e il totale della scuola contano solo lui, e ogni selezione rifà la chiamata.
- **Dimensioni:** `IstruttoreHomeScreen` è di 3938 righe con tutti i rami `ownerMode`, `WeeklyAgendaView` di 2130.

### 1.3 Cosa fa l'istruttore (va garantito al titolare-istruttore)

- Agenda settimana con «+» (Guida, Gruppo, Esame, Teoria, Blocca, Malattia) e creazione dal fantasma.
- Foglio guida completo: presenza/assenza, pagellino «Com'è andata», Sposta/Scambia/Elimina, veicolo/luogo/durata.
- Road dal vivo.
- Disponibilità (orologio) e notifiche (campanella).
- Allievi: dettaglio, pagamenti, storico, Road dell'allievo.
- Ore di guida e «Il mio gruppo» in autonomia.

**Oggi il titolare-istruttore ha già tutto questo.** Va solo conservato.

### 1.4 Cosa offre la web app al titolare

- **Agenda (pagina d'atterraggio).** Due viste:
  - **Settimana**: sottocolonne istruttore × giorno da almeno 80 px;
  - **Giorno**: **una colonna per istruttore**. Su telefono è larga `minmax(128px)` e scorre in orizzontale; colonna ore fissa a sinistra (56 px); testata istruttore fissa in alto (volto 32 + nome).
- **Sotto 768 px il web apre già il Giorno**: «la settimana con N istruttori non sta in 390 px». È il precedente da seguire.
- **Misure e dettagli:**
  - 72 px per ora, zoom da 0.7 a 2.2;
  - linea dell'ora;
  - bande di disponibilità nella tinta dell'istruttore (α .07), col luogo;
  - festivi e note del giorno;
  - filtri per istruttore, veicolo, tipo e stato;
  - ordine delle colonne = `agendaInstructorOrder` (Aspetto);
  - colore dell'istruttore = `AutoscuolaInstructor.color`, usato solo per volto e banda; i blocchi seguono il criterio durata/patente.
- **Nessun «+N»:** le corsie esistono nel codice ma non sono usate. Con una colonna per istruttore le sovrapposizioni sono rare.
- **Niente dashboard.** I segnali sono:
  - «N guide oggi · N questa settimana»;
  - banner «fuori disponibilità» con approva/annulla;
  - campanella titolare (`owner-notifications`: cancellazioni allievi, risposte WhatsApp, consorzio);
  - blocchi annullati con «Assegna sostituto»;
  - cancellazioni tardive.
- **Il web non distingue titolare e titolare-istruttore:** entrambi vedono tutta la scuola.

### 1.5 API: cosa c'è già

| Bisogno | Stato |
|---|---|
| Tutti gli impegni della scuola per un giorno | ✅ `GET /agenda/bootstrap` senza `instructorId`. Il mobile lo usa già, con paging lato client. Per un giorno 400–600 righe bastano. Contiene istruttori con `color`, veicoli, blocchi e festivi |
| Ordine colonne, criterio colore, veicolo sui blocchi | ✅ `GET /settings` |
| Foto degli istruttori | ✅ `GET /user-photos?instructorIds=` |
| Disponibilità di **tutti** gli istruttori in una chiamata | ⚠️ Due possibilità. **(a)** `availability/slots?ownerType=instructor` senza `ownerId`: esiste, ma dà slot da 30 min senza settimane pubblicate né luoghi, quindi può differire dal web. **(b)** L'azione web `getInstructorAvailabilityForAgenda` è esatta ma **non ha una rotta HTTP** → **serve backend (piccolo)** |
| Fuori disponibilità di tutti + approva/annulla | ✅ rotte esistenti |
| Mutazioni del titolare puro (sposta, annulla, presenza, cambio istruttore, malattia/ferie per un altro istruttore) | ❓ Il web le fa con server action. **Va verificato che le rotte mobile accettino `OWNER`**; possibile backend piccolo |
| Notifiche titolare del web (`owner-notifications`) | ❓ Non arrivano al mobile. Fuori perimetro, salvo diversa indicazione |

---

## 2. Analisi di prodotto, area per area

Legenda: **(a)** fisso o configurabile · **(b)** dove sta · **(c)** account: T = titolare puro, TI = titolare-istruttore, I = istruttore · **(d)** piattaforma · **(e)** cosa si riusa.

| # | Area | (a) | (b) | (c) | (d) | (e) |
|---|---|---|---|---|---|---|
| 1 | **Agenda multi-istruttore** (giorno, colonne per istruttore) | Fissa la struttura. Configurabili ordine e colore degli istruttori (web → Aspetto); per dispositivo, l'ultima vista e la densità | Tab Agenda, vista «Tutti» | T, TI | mobile (+ BE opz. per la disponibilità) | bootstrap, `agendaLook`, linea dell'ora e fantasma di `WeeklyAgendaView`, `agendaLanes` (solo dentro la colonna), misure del Giorno web |
| 2 | **Settimana di un istruttore** (fuoco su una colonna) | Fissa | Tocco sulla testata di una colonna → settimana di quell'istruttore | T, TI | mobile | `WeeklyAgendaView` così com'è: con un istruttore solo funziona bene |
| 3 | **«La mia agenda»** del titolare-istruttore | Fissa; si ricorda l'ultima scelta | Agenda: segmentato «La mia · Tutti» in testata | TI | mobile | Agenda istruttore attuale, intatta (FAB, fantasma, check-in, Road) |
| 4 | **Oggi — schermata «onnisciente»** | Fissa | Nuova prima tab «Oggi» | T, TI | mobile | `OwnerInstructorScreen` (stati Libero/In guida, bug corretto), `AgendaTodayCard`, banner fuori disponibilità, `ClayLargeTitleScroll` |
| 5 | **Istruttori**: stato dal vivo, giornata, chiama, disponibilità, malattia/ferie, invito | Fissa | Righe in Oggi → foglio istruttore; invito in Tu | T, TI | mobile (+ verifica BE di malattia/ferie per altri) | `role/instructor-availability` (RangesEditor), `instructor-invite`, `BlockForm` (malattia), `Avatar` |
| 6 | **Azioni sulle guide** (presenza, sposta, annulla, cambio istruttore/veicolo/luogo) | Fisse per ruolo | Foglio guida dall'agenda | Oggi solo TI e I; **proposta: anche T** | mobile + **audit BE** | `manage-lesson` già completo per l'istruttore: si toglie `readOnly` per il titolare |
| 7 | **Creazione** (fantasma, «+») | Fissa | Agenda «Tutti»: il fantasma crea **per l'istruttore della colonna** toccata; «+» chiede l'istruttore | T, TI | mobile | `createKinds`, `BookingForm` con `ownerInstructorOptions`, `BlockForm` |
| 8 | **Fuori disponibilità** (approva/annulla) | Fissa | Avviso in Oggi e banner in Agenda | T e TI: tutte; I: le sue | mobile | `home/out-of-availability` |
| 9 | **Disponibilità come tinta** nelle colonne | Fissa (tinta neutra appena accennata, come oggi) | Agenda «Tutti» | T, TI | **BE consigliato** (rotta) o ripiego con `slots` | Effetto disponibilità di `IstruttoreHomeScreen`, generalizzato |
| 10 | **Esami e gruppi** | Fisse | Fascia esami sopra le colonne; fogli esistenti | T, TI, I | mobile | `exam-manage`, `manage-group-lesson` senza `readOnly` per T |
| 11 | **Festivi e note del giorno** | Configurabili dal web | Testata del giorno | T, TI | mobile (`officeNotes=1` già supportato) | campi `holidays` e `dayNotes` del bootstrap |
| 12 | **Allievi** | Fissa | Tab Allievi | T, TI, I | mobile | `InstructorNotesScreen` così com'è; filtro per istruttore opzionale |
| 13 | **Road** | Fissa | Tab Road (TI, I); per T «In guida ora» in Oggi | TI guida; T guarda | mobile | Road invariata |
| 14 | **Notifiche** | Fisse | Campanella in testata a Oggi (via la tab Notifiche) | T, TI | mobile | `InboxBellButton`, `NotificationInboxScreen` |
| 15 | **Impostazioni, Manutenzione, Aspetto, Veicoli, Luoghi, Pagellino, Ore** | Configurabili | Tab Tu | T, TI (Ore solo TI) | mobile | `MoreScreen`, `SettingsScreen`, `MonthHoursCard` |
| 16 | **Solo web** (regole di prenotazione, crediti, Segretaria, comunicati, utenti, contratti) | — | Restano sul web | — | web | Niente in questo epic |

---

## 3. Architettura proposta

### 3.1 Tab — una barra sola per i due titolari

| Ruolo | Tab |
|---|---|
| Titolare puro | **Oggi · Agenda · Allievi · Tu** |
| Titolare-istruttore | **Oggi · Agenda · Road · Allievi · Tu** |
| Istruttore | invariato |

- Via la tab «Istruttore»: la sua parte utile diventa la sezione Istruttori di Oggi.
- Via la tab «Notifiche»: diventa la campanella in testata.
- «Altro» e «Impostazioni» confluiscono in «Tu», come per l'istruttore.

### 3.2 «Oggi» — la schermata onnisciente

`ClayLargeTitleScroll`, saluto con l'ora, campanella tonda in alto a destra.

1. **Card protagonista «Adesso a scuola»** (livello 1), un numero che conta: «3 in guida ora · 14 guide oggi». Sotto, le prossime due che partono (volto istruttore, allievo, ora). Col calendario 3D della card «Oggi», riusato. A giornata finita: «Tutte fatte».
2. **Livello 2, massimo due card piccole, e solo se servono:**
   - «N guide fuori disponibilità → Gestisci»;
   - «N assenze / annullate da riassegnare».
   Se non c'è niente, non c'è niente.
3. **Livello 3, sezione «Istruttori» a righe:**
   - volto, nome, stato a parole («In guida con Rossi fino alle 11:00», «Libero fino alle 14:00», «Malattia», «Non lavora oggi»);
   - tocco → **foglio istruttore**: la sua giornata a righe, Chiama, «Vedi la settimana», «Disponibilità», «Segna malattia/ferie».
4. **Solo titolare-istruttore:** riga «La tua giornata: 5 guide, la prossima alle 10:00» → Agenda «La mia».

### 3.3 La nuova agenda multi-istruttore — tre concetti

**A · Giorno a colonne-istruttore (come il web su telefono) ⭐ preferito**

```
 ‹ mer 26 nov ›                       Oggi
 lun mar [mer] gio ven sab     ← striscia settimana, tocco = giorno
 ┌────┬──────────┬──────────┬──────┈
 │    │ (●) Marco│ (●) Sara │ (●) L    ← testata fissa: volto + nome
 │ 08 │┌────────┐│          │          (tocco = settimana di Marco)
 │    ││Rossi   ││┌────────┐│
 │ 09 ││08–09 B │││Bianchi ││
 │    │└────────┘││09–10   ││
 │ 10 │ ░░░░░░░░ │└────────┘│        ░ = disponibilità (tinta lieve)
 └────┴──────────┴──────────┴──────┈  → scorre in orizzontale
```

- Colonna ore fissa a sinistra (44 pt).
- Colonne a larghezza fissa ~132 pt: su iPhone se ne vedono 2,5, e la mezza dice «scorri». Scroll orizzontale libero; verticale condiviso.
- Testata istruttori fissa che segue lo scroll orizzontale; ordine = `agendaInstructorOrder`. Il titolare-istruttore ha la sua colonna per prima.
- **Blocchi larghi e leggibili**: cognome e nome, orario, patente o veicolo. Stessi colori di oggi (`agendaLook`).
- Fascia esami sopra la griglia; linea dell'ora; festivo e nota del giorno nella testata.
- Fantasma: crea per l'istruttore della colonna.
- **Prestazioni:** per giorno una sola chiamata (bootstrap del giorno, con i giorni vicini precaricati). Le colonne si montano solo se sono vicine alla vista (finestra a mano: da 30 istruttori se ne disegnano ~5). Blocchi in memo, una sola ombra.
- Il giorno cambia dalla striscia, non con lo swipe, che resta allo scroll orizzontale.
- ✅ Leggibile; scala; è lo stesso modello mentale del desktop.
- ❌ Non si vedono tutti in un colpo solo; serve scorrere.

**B · Timeline per istruttore (righe-istruttore, ore in orizzontale)**

```
            08    09    10    11    12
 (●) Marco  [Rossi ][Verdi ]      [Neri]
 (●) Sara         [Bianchi][Esposito]
 (●) Luca   ░░░░░░[Gallo]░░░░░░░░░░░░
```

- Una riga di 64 pt per istruttore: `FlatList` verticale virtualizzata nativamente, ottima anche con 30 istruttori.
- Asse delle ore fisso in alto; nomi fissi a sinistra; scroll orizzontale sincronizzato.
- ✅ Si vede tutta la scuola e dove sono i buchi.
- ❌ Una guida da 1 h è larga ~60 pt: il nome entra a fatica; un'ora sola a schermo ne mostra ~5. Lo scroll orizzontale sincronizzato su una lista virtualizzata è delicato su Android. È più lontano dal web.

**C · Elenco per istruttore (righe e sezioni, niente griglia)**

- Sezioni per istruttore, nell'ordine dell'autoscuola: volto, nome, «6 guide · 08:00–17:00».
- Sotto, le guide come righe: ora, allievo, tipo, stato.
- Variante «Adesso»: un'unica lista in ordine di orario con l'istruttore sulla riga.
- ✅ Il più nativo e leggibile, iOS puro, virtualizzazione gratis.
- ❌ Non mostra i buchi né le sovrapposizioni; per creare «in un buco» serve un passo in più.

**Preferito: A**, per tre motivi:
1. **È la risposta che il web ha già dato** allo stesso problema su telefono; il brief chiede di rifarsi al web nei punti di crisi.
2. **Tiene tutto ciò che la griglia sa fare:** creazione dal fantasma, disponibilità, linea dell'ora.
3. **Riusa** `agendaLook` e i fogli.

La settimana resta disponibile **per un istruttore alla volta** (tocco sulla testata della colonna), dove la griglia attuale funziona. La **settimana «Tutti» va tolta**: è proprio lo screenshot illeggibile. C si può aggiungere più avanti come seconda vista («Elenco») se servirà.

### 3.4 Titolare-istruttore: «la mia agenda» e le azioni da istruttore

- **In testata all'Agenda, segmentato nativo a due voci «La mia · Tutti».** Si ricorda l'ultima scelta; la prima volta parte da «La mia».
  - **«La mia»** = l'agenda istruttore di oggi, **identica**: settimana, FAB «+», fantasma, check-in, pagellino, Road, disponibilità (orologio).
  - **«Tutti»** = concetto A. La sua colonna è la prima; le azioni sulle sue guide sono le stesse di «La mia».
- Il fantasma in una colonna di un collega crea per quel collega (oggi crea sempre per sé: è un bug di prodotto).
- **Road** resta una tab sua; Ore di guida e «Il mio gruppo» restano in Tu.
- Il titolare puro vede solo «Tutti» (nessun segmentato).

### 3.5 Struttura del codice

- **Nuova schermata `OwnerAgendaScreen`** con dentro `SchoolDayView` (il concetto A, componenti nuovi in `src/components/schoolDay/`).
  - «La mia» monta l'`IstruttoreHomeScreen` attuale **senza toccarlo**.
  - Via i rami `ownerMode` da 3938 righe, a lavoro finito.
- **Nuovo hook `useSchoolDay(date)`:** bootstrap del giorno senza `instructorId` + disponibilità di tutti + foto. TanStack Query, precarica ±1 giorno, niente fetch al tocco.
- **`OwnerTodayScreen`** nuova. `OwnerInstructorScreen` va in pensione (il bug si risolve rifacendolo).

---

## 4. Backend necessario (da fare in un worktree web separato, non da solo)

1. **`GET /api/autoscuole/agenda/availability?from&to`.** Rotta sottile su `getInstructorAvailabilityForAgenda`, per avere le bande identiche al web con una sola chiamata. **1 punto.** Senza, ripiego su `availability/slots`, che può differire nelle settimane pubblicate.
2. **Audit dei permessi `OWNER`** sulle rotte mobile delle mutazioni (sposta, annulla, presenza, esito, cambio istruttore, malattia/ferie/blocchi per un altro istruttore) e correzioni. **1–2 punti**, solo se il titolare puro deve poter agire (vedi domande).

---

## 5. Sotto-task (scala 0/1/2/3/5), in ordine

| # | Sotto-task | Pt | Dipende da | Piattaforma |
|---|---|---|---|---|
| 1 | **Anteprime** HTML dei tre concetti con dati realistici (8 istruttori, giornata piena) + Oggi → ok di Tiziano | 2 | — | anteprima |
| 2 | BE: rotta disponibilità di tutti + audit permessi `OWNER` | 2 | 1 (ok) | backend |
| 3 | Barra delle tab dei titolari (Oggi · Agenda · [Road] · Allievi · Tu), campanella in testata, via la tab Istruttore/Notifiche, Tu unificato | 2 | 1 | mobile |
| 4 | `useSchoolDay`: dati del giorno, ordine e colori, foto, disponibilità (con ripiego), precarico ±1 | 3 | 2 (o ripiego) | mobile |
| 5 | `SchoolDayView` parte 1: griglia a colonne, testata fissa sincronizzata, colonna ore, blocchi `agendaLook`, linea dell'ora, striscia settimana, skeleton | 5 | 4 | mobile |
| 6 | `SchoolDayView` parte 2: fascia esami, disponibilità, festivi e note del giorno, finestra di colonne (virtualizzazione), giro prestazioni con 20+ istruttori | 3 | 5 | mobile |
| 7 | Interazioni: tocco blocco → fogli esistenti; fantasma per istruttore di colonna; «+» con scelta istruttore | 3 | 5 | mobile |
| 8 | Fuoco istruttore (testata → sua settimana) + segmentato «La mia · Tutti» per il titolare-istruttore | 2 | 5 | mobile |
| 9 | Titolare puro: via il `readOnly` dai fogli guida, esame e gruppo, secondo l'audit | 2 | 2, 7 | mobile |
| 10 | «Oggi»: card «Adesso a scuola», avvisi, sezione Istruttori con stato dal vivo | 3 | 4 | mobile |
| 11 | Foglio istruttore: giornata, chiama, settimana, disponibilità, malattia/ferie | 3 | 10, 2 | mobile |
| 12 | Pulizia: pensione di `OwnerInstructorScreen` e dei rami `ownerMode`; doc (feature nuova, INDEX, impact-map, design-system §6.20) | 2 | 3–11 | mobile |
| 13 | QA iOS + Android in simulatore (un ruolo per volta), ok di Tiziano, OTA doppia | 1 | 12 | rilascio |

**Totale ≈ 33 punti.**

**Percorso critico:** 1 → 4 → 5 → 7 / 8. Oggi (10–11) può procedere in parallelo dopo il 4. Il rilascio può essere unico, oppure in due tempi: prima Agenda + tab (3–9), poi Oggi (10–11).

---

## 6. Domande aperte per Tiziano

1. **Titolare puro: deve poter agire sulle guide** (presenza, sposta, annulla, cambio istruttore), come sul web? Io dico sì: «onnisciente» senza poter toccare niente è a metà. Vuol dire audit e piccolo backend (task 2).
2. **Settimana «Tutti gli istruttori»: la tolgo** e tengo la settimana solo per un istruttore alla volta? Io dico sì.
3. **Backend:** apro un worktree web per la rotta della disponibilità (1 punto)? Oppure accetti per ora il ripiego con `availability/slots`?
4. **Notifiche titolare del web** (cancellazioni allievi, risposte WhatsApp): le porto nell'app? Le terrei fuori da questo epic, come task a parte.
5. **Rilascio:** unico o in due tempi (Agenda prima, Oggi dopo)?

Dopo l'ok, la FASE 2 parte dal task 1: anteprime HTML dei concetti A/B/C e di Oggi, con 8 istruttori su una giornata piena, in `/tmp/hiro-anteprime/reg-794/`. Il piano approvato va salvato anche in `reglo-mobile/plans/owner/001-app-titolare.md`.
