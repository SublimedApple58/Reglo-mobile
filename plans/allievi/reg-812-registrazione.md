# REG-812 — Registrazione dell'allievo a passi

> **Fatto (27/11/2026, in produzione).** Registrazione in sette passi (codice, autoscuola, nome, email, cellulare, password, «Tutto giusto?»), patente e cambio come step `license` dell'onboarding prima delle disponibilità, home «Ci siamo quasi» e scelta dell'autoscuola rifatte, lucchetto 3D nuovo. Tolto l'invito da app (schermata, tre rotte, link nella mail); l'invito staff dal web resta. Non fatta, per decisione di Tiziano: la verifica dell'email con codice. Web `9f54a29`, mobile `92f2402`, OTA su runtime 2.4.2 e 2.4.0. Dettagli in `docs/features/registrazione.md`.

Sotto, il piano originale approvato.

# REG-812 — Registrazione dell'allievo: ricognizione e piano

Stato: solo ricognizione, nessun codice toccato. Worktree `reglo-mobile-worktrees/reg-812`, branch `feat/reg-812-registrazione` da `origin/master` (eb89dae). Simulatore spento, nessun Metro.

Catture di oggi: `/tmp/hiro-anteprime/reg-812/oggi/` (18 immagini, numerate come sotto).

---

## 1. Il flusso di oggi, schermata per schermata

### 1.1 Benvenuto — `01-benvenuto.png`
- File: `src/screens/AuthWelcomeScreen.tsx`.
- Logo, «Benvenuto in Reglo», «La tua autoscuola, in tasca».
- Tre ingressi: «Registrati come allievo» (CTA nera), «Primo accesso» (CTA bianca), «Hai già un account? Accedi» (link).
- Riga di aiuto: «Ti ha già iscritto l'autoscuola? Scegli Primo accesso.»
- Giudizio: è l'unica schermata già in linea con le regole.

### 1.2 Registrazione — `02` … `07`
- File: `src/screens/SignupScreen.tsx`, rotta `app/(auth)/signup.tsx`.
- iOS: foglio a pagina (modal). Android: schermo intero.
- Un solo modulo con cinque campi insieme: nome completo, email, numero di cellulare, password, codice di invito. Poi la frase sul consenso WhatsApp, «Crea account», «Hai già un account? Accedi».
- `02-registrazione-vuota.png`: il modulo vuoto.
- `03-registrazione-errori-in-inglese.png`: toccando «Crea account» a vuoto esce un blocco rosso in inglese («Name must be at least 3 characters. Invalid email address. Password must be at least 6 characters…»).
- `04-registrazione-tastiera.png`: telefono come testo libero, segnaposto «+39 …», senza prefisso.
- `05-codice-coperto-dalla-tastiera.png`: mentre scrivi il codice la tastiera lo copre.
- `06-registrazione-compilata.png`: modulo compilato.
- `07-codice-non-valido.png`: «Codice di invito non valido» arriva solo alla fine, dopo aver compilato tutto.
- `08-popup-password.png`: popup di sistema «Vuoi salvare la password?» sopra la schermata successiva.

### 1.3 Disponibilità — `09-disponibilita-reg802.png`
- È lo step `availability` dell'onboarding di REG-802 («Quando puoi fare guida?»), rimandabile con «Configura in seguito» per chi non è ancora in fase guide.
- Arriva PRIMA del percorso patente: chiediamo quando puoi guidare prima di sapere che patente fai.

### 1.4 Percorso patente — `10` … `13`
- File: `src/screens/LicensePathGateScreen.tsx`, montato in `app/(tabs)/_layout.tsx` (REG-410).
- Compare solo se l'autoscuola lascia la scelta all'allievo (`licensePathMode = student_choice`, il default). Con «patente fissa» non compare.
- `10-percorso-patente.png`: fondo grigio con macchie, icona a gradiente, sette patenti (B, AMQ, B1, AM, A1, A2, A). AMQ e B1 senza descrizione.
- `11-percorso-patente-cambio.png`: in fondo «Tipo di cambio» con l'etichetta «OBBLIGATORIO».
- `12-percorso-scelte-fatte.png`, `13-percorso-patente-b.png`: stato selezionato, CTA «Conferma e continua →», «Account sbagliato? Esci».

### 1.5 Primo ingresso: home «Ci siamo quasi» — `14`, `15`, `16`
- File: `src/screens/AllievoAwaitingScreen.tsx`.
- Dove atterra l'allievo se l'autoscuola ha la teoria attiva e non assegna da sola i quiz (fase AWAITING). Altrimenti atterra nella home teoria o nella home guide.
- Razzo 3D del vecchio set, titolo, scheda «IL TUO PERCORSO» (eyebrow) con la pillola «In corso», entrate dal basso.
- `16-esci-conferma.png`: l'uscita passa da un Alert di sistema.

### 1.6 Schermate di contorno
- `17-accedi.png`: foglio «Accedi» (non in discussione, serve da confronto).
- `18-invito-da-link.png`: `InviteAcceptScreen`, invito via email con link. Stile vecchio (`Card`, `Button`, `Input`). Nessun punto dell'app crea più questi inviti.
- Scelta autoscuola (`CompanySelectScreen`, `app/(auth)/company-select.tsx`): NON catturata, perché su staging nessun account ci arriva senza modificare i dati. Dal codice: titolo «Seleziona autoscuola», una scheda con un bottone per autoscuola («Seleziono...» come stato di caricamento, cioè cambio di etichetta), bottone «Esci». Vecchio tema.
- Prefisso (`country-picker`): esiste già come form sheet, oggi la registrazione non lo usa.

### 1.7 Cosa non esiste
- Nessuna verifica dell'email né del numero.
- Nessuna rotta per controllare il codice prima di creare l'account.

---

## 2. Cosa non va (in ordine di gravità)

1. Errori in inglese e tutti insieme (`03`).
2. Il codice si controlla solo alla fine e non si vede mai a quale autoscuola ci si iscrive (`07`).
3. La tastiera copre il campo del codice (`05`).
4. Cinque campi in un colpo solo, contro «una sola cosa protagonista per schermata».
5. Telefono a testo libero, senza il campo con prefisso di REG-802.
6. Stile vecchio nel foglio: etichette sopra i campi, CTA squadrata a gradiente, nessuna icona 3D.
7. Percorso patente fuori regola: fondo grigio, macchie, gradiente, etichetta «OBBLIGATORIO», glifi al posto delle icone 3D, descrizioni mancanti.
8. Ordine sbagliato: disponibilità prima della patente.
9. Home in attesa fuori regola: pillola, eyebrow, entrate dal basso, icone del vecchio set.

---

## 3. Chi lo usa

- L'allievo che scarica l'app da solo e ha un codice di 6 caratteri.
- Il codice può essere di tre tipi (`lib/autoscuole/signup-invite.ts`):
  - dell'autoscuola;
  - di un istruttore autonomo attivo: l'allievo entra nel suo gruppo;
  - di un luogo (solo con «Disponibilità per luogo» attiva): l'allievo riceve quel luogo.
- Chi è stato iscritto dall'autoscuola NON passa di qui: fa il Primo accesso.
- Non ho contato quanti allievi in prod si sono registrati da soli: è una lettura sola, si fa su richiesta.

---

## 4. Piano prodotto

Idea: la registrazione diventa un percorso a passi identico per forma al Primo accesso e all'onboarding di REG-802. Si parte dal codice, si vede subito la propria autoscuola, poi una domanda per schermata. La patente diventa uno step dell'onboarding e viene prima della disponibilità.

Percorso nuovo:
1. Benvenuto (invariato)
2. Codice di invito
3. «È la tua autoscuola?»
4. Come ti chiami
5. La tua email
6. Il tuo numero
7. Scegli una password → si crea l'account
8. Che patente fai? (solo se l'autoscuola lascia la scelta)
9. Manuale o automatico? (idem)
10. Quando puoi fare guida? (REG-802, com'è)
11. Home

### Cosa si riusa dello scheletro dell'onboarding
- `FirstAccessStepScreen` per ogni passo: barra di avanzamento, indietro, icona 3D eroe a 64 pt, titolo, sottotitolo, CTA tonda che sale con la tastiera, errore sotto il campo, dissolvenze (`fadeIn`/`fadeOut`), `useFocusAfterPush`.
- Un contesto con la bozza, sul modello di `FirstAccessContext` / `OnboardingContext`.
- `PhoneField` + `country-picker` per il numero.
- Il passo password del Primo accesso.
- `ClayField`, `ClayList`, `ClayListRow`, `ClayButton`, `Icon3D`, `VITA_ART`.
- L'onboarding server-driven (`resolveOnboarding`, AuthGate) per patente e disponibilità.

### Cosa si toglie
- `SignupScreen` (modulo unico, due modalità iOS/Android).
- L'uso di `AuthField`, `GradientCTA` e `GlassCloseButton` nella registrazione.
- `LicensePathGateScreen` e il suo montaggio nelle tab (resta solo per i backend vecchi, vedi fasi).
- `InviteAcceptScreen` e la rotta `invite/[token]`, se confermato.
- La presentazione a foglio della registrazione: diventa uno stack a schermo intero, uguale su iOS e Android.

---

## 5. Proposta per ogni schermata

Regole valide per tutte: fondo bianco, nero e clay leggero, nessuna pillola/badge/eyebrow, gerarchia a tre livelli (titolo, sottotitolo, contenuto), peso dei font 500–600, CTA tonda con spinner, dissolvenze 200–300 ms, niente entrate dal basso, niente `useReducedMotion`.

### 5.1 Benvenuto
- Resta com'è. Unica modifica: «Registrati come allievo» apre lo stack nuovo con un push invece del foglio.

### 5.2 Codice di invito
- Eroe: chiave 3D (esiste già nella web app, `chiave-3d.png`; è quella del Primo accesso).
- Titolo: «Il tuo codice di invito».
- Sottotitolo: «Te lo dà la tua autoscuola o il tuo istruttore.»
- Contenuto: sei caselle grandi clay, maiuscole automatiche, incolla supportato; la tastiera non le copre mai.
- CTA «Avanti», spenta finché non ci sono sei caratteri; al tocco spinner e controllo sul server.
- Errore sotto le caselle: «Questo codice non esiste. Controlla di averlo scritto bene.»
- Sotto la CTA, testo discreto: «Non hai un codice? Chiedilo alla tua autoscuola.»

### 5.3 «È la tua autoscuola?»
- Eroe: il logo vero dell'autoscuola in un tondo clay; se non c'è, l'edificio 3D (`VITA_ART.edificio`).
- Titolo: il nome dell'autoscuola.
- Sottotitolo secondo il codice: «Ti stai iscrivendo qui.» / «Con l'istruttore Luca Bianchi.» / «Sede di via Roma.»
- CTA «Sì, è lei». Sotto, testo: «Non è la tua? Cambia codice» (torna indietro).
- Stato di caricamento: skeleton di logo e nome mentre arriva la risposta (se il controllo è già fatto al passo prima, compare subito).

### 5.4 Come ti chiami
- Eroe: tessera 3D (`VITA_ART.tessera`).
- Titolo: «Come ti chiami?»
- Sottotitolo: «Scrivilo come sui documenti: serve all'autoscuola per la tua pratica.»
- Due campi clay: nome, cognome. Tastiera aperta al push.
- CTA «Avanti».

### 5.5 La tua email
- Eroe: busta 3D (`VITA_ART.busta`).
- Titolo: «La tua email».
- Sottotitolo: «Ti serve per recuperare la password e per le comunicazioni dell'autoscuola.»
- Un campo. Al tocco di «Avanti» controllo sul server.
- Errore: «Esiste già un account con questa email.» con sotto il testo toccabile «Accedi».

### 5.6 Il tuo numero
- Eroe: telefono 3D (`VITA_ART.telefono`).
- Titolo: «Il tuo numero di cellulare».
- Sottotitolo: «Lo userai per accedere e per ricevere gli avvisi sulle guide.»
- `PhoneField` con prefisso (form sheet «Prefisso» già esistente).
- Sotto il campo, in piccolo, il consenso WhatsApp di REG-500: «Continuando accetti di ricevere su WhatsApp gli avvisi sulle tue guide. Puoi smettere quando vuoi dal profilo o rispondendo STOP.»
- CTA «Avanti», spenta finché il numero non è completo.

### 5.7 Scegli una password
- Eroe: nessuno oggi nel Primo accesso; proposta: lucchetto 3D nuovo (Gemini, blocco STILE) da usare in entrambi. Si può anche fare senza.
- Titolo: «Scegli una password».
- Sottotitolo: «Con la tua email o il tuo numero e questa password entrerai nell'app.»
- Un campo con «Mostra», regola scritta sotto («Almeno 6 caratteri»).
- CTA «Crea account» con spinner. Errori del server in italiano sotto il campo; se l'errore riguarda un altro passo (email, codice) si torna a quel passo.

### 5.8 Che patente fai?
- Eroe: volante 3D (`VITA_ART.volante`).
- Titolo: «Che patente fai?»
- Sottotitolo: «Serve alla tua autoscuola per organizzare le guide.»
- `ClayList` a righe: icona 3D auto o moto già esistenti, sigla, descrizione sempre presente (B Auto · AM quadriciclo · B1 Quadriciclo pesante · AM Ciclomotore · A1 Moto 125 · A2 Moto media · A Moto senza limiti). Selezione con spunta a destra, niente anelli colorati.
- CTA «Avanti», spenta finché non si sceglie. In alto a destra, al posto della X, niente: l'uscita è «Esci» nel menu dell'onboarding (`OnboardingExit`), come negli altri step obbligatori.

### 5.9 Manuale o automatico?
- Eroe: nessuno, oppure la stessa icona della patente scelta (auto o moto).
- Titolo: «Cambio manuale o automatico?»
- Sottotitolo: «Se non lo sai ancora scegli manuale: l'autoscuola può cambiarlo.» (da confermare con Tiziano)
- Due righe clay: «Manuale — con la frizione», «Automatico — senza frizione».
- CTA «Avanti» con spinner: qui si salva il percorso.

### 5.10 Quando puoi fare guida?
- Lo step di REG-802, invariato. Cambia solo la posizione: dopo la patente.

### 5.11 Primo ingresso: «Ci siamo quasi»
- Stessa struttura, ripulita: via l'eyebrow «IL TUO PERCORSO», via la pillola «In corso» (la tappa attuale si distingue per peso del testo e icona piena), via le entrate dal basso (solo dissolvenza), icone del set nuovo, «Esci» come riga discreta.
- Eroe: il razzo va sostituito con un'icona del set attuale (da cercare prima nella web app).

### 5.12 Scelta autoscuola
- Titolo «Quale autoscuola?», sottotitolo «Ciao Sara, sei iscritta a più di una.»
- `ClayList` con logo e nome; al tocco spinner sulla riga, nessun cambio di etichetta.
- «Esci» come testo in fondo.

### 5.13 Invito da link
- Proposta: toglierlo.

---

## 6. Fasi

### Fase 1 – Backend (repo `reglo`, worktree `reg-812` da `origin/staging`)
- Rotta nuova per controllare il codice: restituisce nome e logo dell'autoscuola, eventuale istruttore o luogo, e se l'autoscuola chiede la patente all'allievo. Protetta dai tentativi a raffica.
- Controllo «email già usata» prima dell'ultimo passo.
- Messaggi di `student-register` in italiano.
- Step `license` nell'onboarding (`buildOnboardingSteps`), prima di `availability`. Le app vecchie ignorano lo step e tengono il blocco attuale (`needsLicensePath` resta).
- Nessuna migrazione prevista. Nessun job Trigger.
- Domanda tecnica aperta: nessun limite ai tentativi sulle rotte di auth oggi; va deciso dove metterlo.

### Fase 2 – Anteprime
- Anteprima di ogni schermata della sezione 5, da approvare prima del codice. Catture in `/tmp/hiro-anteprime/reg-812/giro1/`.

### Fase 3 – Registrazione a passi (mobile)
- Stack `app/(auth)/signup/*`, contesto con la bozza, passi 5.2–5.7.
- Via `SignupScreen`.

### Fase 4 – Patente come step dell'onboarding (mobile)
- Passi 5.8 e 5.9 in `app/onboarding`, `ONBOARDING_SCREENS` aggiornato.
- Il blocco nelle tab resta solo come ripiego per un backend vecchio, poi si toglie.

### Fase 5 – Primo ingresso e resti (mobile)
- Home «Ci siamo quasi», scelta autoscuola, rimozione dell'invito da link.

### Fase 6 – QA e rilascio
- QA su staging con un solo simulatore, catture finali.
- Rilascio solo col via: backend in prod prima, poi OTA doppia (runtime 2.4.2 e 2.4.0).
- Docs: `docs/features/registrazione.md` nuovo sul mobile, aggiornamento di `license-path-gate.md`, `onboarding-allievo.md`, INDEX e impact-map; sul web la doc dell'onboarding.

### Web
- Nessuna interfaccia web. Solo le rotte della Fase 1.

### Icone 3D
- Riuso: chiave, tessera, busta, telefono, volante, auto, moto, orologio, edificio.
- Da generare forse: lucchetto (password) e il sostituto del razzo, dopo aver controllato la web app.

---

## 7. Domande aperte

1. Home «Ci siamo quasi» e scelta autoscuola: dentro questo task (Fase 5) o in un task a parte? Proposta: dentro, sono il primo ingresso.
2. Invito da link: si può togliere?
3. Verifica dell'email con codice: oggi non c'è. Proposta: non aggiungerla ora.
4. Riepilogo «Tutto giusto?» prima di creare l'account: proposta di saltarlo.
5. Cambio: va bene suggerire «se non lo sai scegli manuale»?
6. Lucchetto 3D per la password: lo generiamo o restiamo senza icona su quel passo?

---

## 8. Note

- Su staging è rimasta l'allieva di prova «Giulia Prova» (`giulia.reg812a@example.com`, Autoscuola Reglo): si toglie a fine task.
- Il crash/riquadro rosso visto all'avvio nel simulatore è della build di prova (errore `USER_NOT_AUTHENTICATED` mostrato in sovrimpressione), non riguarda la registrazione.
