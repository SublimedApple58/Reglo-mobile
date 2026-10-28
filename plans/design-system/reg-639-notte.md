# REG-639 notte — clay su tutta l'app istruttore/titolare

> Lavoro notturno del 28→29/10/2026, piano approvato (con note) da chi gestisce Tiziano.
> Branch `feat/reg-639-clay-ds`, worktree `reglo-mobile-worktrees/reg-639`. Commit locali per fase, niente push/OTA.
> Anteprime ritagliate per fase in `/tmp/hiro-anteprime/clay/notte/<sezione>/`.

## Cosa è stato fatto
_(aggiornato a fine di ogni fase)_

- [x] Fase 0 — basi (`302f8f0`): primitivi `ClaySection`, `ClayToggle`, `ClayField`, `ClayEmpty`; 13 icone Gemini generate (tavola `/tmp/hiro-anteprime/clay/icone/tavola-notte.png`), 5 di morale in `assets/morale/` (`src/theme/moraleArt.ts`). FormSheet lungo su Android non verificabile stanotte (niente emulatore): da provare.
- [x] Fase 1 — Agenda (`de4124a`): `src/components/agenda/AgendaDayView.tsx` + `AgendaDayStrip.tsx`, testata nuova in `IstruttoreHomeScreen`, aspetto unico dei blocchi in `src/utils/agendaLook.ts` (interruttore `AGENDA_BLOCK_BAR` in `agendaColors`), Settimana ripulita (colonne bianche, binario disponibilità, blocchi neutri, «Pausa», linea adesso nera, tocco sul giorno → Giorno), foglio «Nuovo» su FormSheet senza icone, quick-book col segmentato clay; le 21 chiamate di disponibilità ora partono per settimana e non a ogni giorno. Anteprime `/tmp/hiro-anteprime/clay/notte/agenda/`. Correzioni dopo la revisione: (blu neutralizzato sul mobile: poi tolto il 29/10, i colori seguono «Aspetto agenda»). Settimana: giorni in minuscolo come nella vista Giorno, disponibilità = tinta di fondo appena accennata; spazio in fondo alle liste per il «+»; via il «+» dentro «Libero».
  - **Superata il 29/10 (commit `7361d96`)**: Tiziano ha bocciato la vista Giorno e la barretta. Agenda = **solo Settimana** (come dopo REG-638, tocco sul giorno come prima), blocchi a **riempimento pastello pieno** senza bordo con ombra morbida in tinta (`AGENDA_BLOCK_BAR = false`). `AgendaDayView` / `AgendaDayStrip` eliminati. Anteprima `/tmp/hiro-anteprime/clay/agenda-v3/confronto.png`.
- [x] Fase 2 — fogli dell'Agenda (`551fe5a`): ~30 fogli su `FORM_SHEET` + `<FormSheet>` (gestisci guida + sottofogli, guide di gruppo, co-istruttori, note, pagellino unificato, prenota/blocca/lezione teorica/malattia, auto al seguito, esami, allievi d'esame, guida di gruppo, sposta, scambia, fuori disponibilità, data, intervallo, allievo, ora). Via Fluent, pillole di stato (lo stato è testo), eyebrow, fondi grigi, footer fissi, molla con rimbalzo di «Gestisci guida». Anteprime `/tmp/hiro-anteprime/clay/notte/fogli-agenda/`.
- [x] Fase 3 — Disponibilità (`8c71375`): testata con indietro + titolo grande, orari settimanali come lista (fasce in testo), eccezioni, pubblicazione per settimana senza pillole; fogli giorno/eccezione/ora su FormSheet. Anteprime `/tmp/hiro-anteprime/clay/notte/disponibilita/`.
- [x] Fase 4 — Tu (`e1dfa57`): «Tu» (profilo, Gestione, Account, Esci rosso), Ore di guida (numero grande + trofeo), Veicoli, Luoghi, Pagellino, Aspetto agenda, Impostazioni; Panoramica istruttori del titolare (lista con ricerca, fogli invito e disponibilità su FormSheet al posto dei BottomSheet). Anteprime `/tmp/hiro-anteprime/clay/notte/tu/`.
- [x] Fase 5 — resto + Fluent (`302f679`): notifiche (sezioni per giorno, aeroplanino, indietro dalla campanella), `RoadLessonCard` bianca; **tutte le 17 Fluent eliminate**: nelle schermate allievo/Allievi sostituite con le icone Gemini (`assets/icons3d-ai/`) a impaginazione invariata. Anteprime `/tmp/hiro-anteprime/clay/notte/resto/`.
- [x] Ritocchi finali: testata fissa (titolo + X) in tutti i fogli del componente unico; linea «adesso» che finisce prima del «+» e spazio in fondo alla vista Giorno pari al «+» più margine. Tavola riassuntiva: `/tmp/hiro-anteprime/clay/notte/riepilogo.png`.
- [x] Fase 6 — documentazione: design-system §0.4/§0.5/§13.2/agenda, feature doc agenda-istruttore + colori blocchi + quick-book, INDEX, impact-map, CLAUDE.md.

---

## Perimetro

Tutta l'app mobile istruttore/titolare in clay leggero REG-639, TRANNE la sezione Allievi (resta com'è) e Road (già fatta). Solo UI: niente logica né API.

Regole sempre valide: bianco puro, testi e CTA neri, mai fondi grigi/crema, mai blu/navy; clay leggero; CTA primaria variante A, secondaria che sprofonda; tab bar FLAT T1 invariata; form sheet nativi = `FORM_SHEET` + `<FormSheet>` (senza maniglia, X clay, scrolla il foglio stesso, mai ScrollView interna); niente pillole/badge/tag/eyebrow; iOS nativo + Airbnb; liste per numeri reali; animazioni sobrie senza rimbalzo, `ReduceMotion.Never`, mai `useReducedMotion`.

## Inventario (stato al 28/10)

- **Agenda**: `IstruttoreHomeScreen` [3794] + `WeeklyAgendaView` [1769]; il titolare la vede in sola lettura (`TitolareHomeScreen`). Una sola vista (griglia settimanale lun–sab, colonne grigie, blocchi sovrapposti). ~30 fogli: add-action, quick-book, new-booking, block-slot, theory-lesson, sick-leave, create-exam, create-group-lesson, manage-lesson (+ details, correct, instructor, vehicles, location, location-form), manage-group-lesson (+ participants, co-instructors, edit-notes), exam-manage (+ select-exam-students), reschedule-lesson, swap-lesson, cancel-fault, out-of-availability, select-date, select-date-range, select-student, time-picker, follow-car-conflict(-long).
- **Disponibilità**: `InstructorAvailabilityScreen` + `DefaultAvailabilityEditor` + `PublicationModeEditor`; fogli availability-exception, publish-day, time-picker.
- **Tu**: `MoreScreen` → profile-edit, Panoramica istruttori (`OwnerInstructorScreen`, 2 BottomSheet + TimePickerDrawer), Ore di guida (+ hours-period), Veicoli (+ vehicle-form, time-picker), Luoghi (+ location-form), Pagellino (+ evaluation-item), Aspetto agenda (+ color-picker), Impostazioni (`SettingsScreen` + availability-mode, agenda-settings).
- **Resto**: notifiche (`NotificationInboxScreen`), scambi (`SwapOffersScreen` + swap-detail), inviti guide di gruppo, home titolare.
- **Fogli**: 44 route + 3 fogli fatti a mano; 0 su `FORM_SHEET` + `<FormSheet>` fuori da Road.
- **Fuori**: Allievi (`InstructorNotesScreen`, dettaglio allievo, pagamenti, cluster settings, rotte `notes/*`), schermate allievo, Road.

## Nuova Agenda

> **Superato il 29/10**: la parte qui sotto su vista Giorno, striscia dei giorni, buchi «Libero» e barretta di colore è stata bocciata da Tiziano. Oggi l'agenda è **solo la Settimana** (griglia clay: colonne bianche, disponibilità come tinta appena accennata, giorni in minuscolo) con blocchi a **riempimento pastello pieno**, niente barretta, ombra morbida in tinta. Il resto (testata, FAB, foglio «Nuovo») vale.

- **Testata**: titolo grande «Agenda» + data sotto; a destra due bottoni clay (disponibilità, campanella). Via «Ciao 👋».
- **Navigazione**: `ClaySegmented` «Giorno | Settimana», si apre su **Giorno**; passaggio fluido (dissolvenza incrociata). Sotto, striscia di 6 giorni scorrevole a settimane: giorno scelto in cerchio nero clay, sotto il numero di guide in grigio piccolo (numero, non badge). Tocco sulla data → calendario del mese in foglio.
- **Vista Giorno (nuova)**: lista verticale per orario.
  - Guide = card bianche clay: ora inizio/fine a sinistra, nome allievo 17/600, sotto tipo guida + veicolo in grigio. **Colore dell'autoscuola = barretta verticale 4px a sinistra + tinta leggerissima dello stesso colore come fondo, testo nero** (nota 2: riconoscibile a colpo d'occhio, facile da tornare indietro → un solo punto nel codice). Automatico = contorno nero 2px (REG-622). Annullate/assenti = testo grigio con lo stato scritto.
  - Buchi liberi: dove c'è disponibilità e nessuna guida, riga tratteggiata leggera «Libero · 10:00–11:30 · 1 h 30» → tocco apre la prenotazione con l'orario già messo.
  - Esami: card clay «Esame» + elenco allievi; esami senza orario come prima riga del giorno.
  - Pause/malattie/blocchi/ferie: righe sottili grigie («Pausa 15 min», «Bloccato», «Malattia»), non card. La pausa tra guide (`lesson_buffer`) si legge «Pausa» (oggi «Bloccato»).
  - «Adesso»: linea nera sottile con l'ora (via il rosso).
  - Giornata vuota: icona 3D (tazzina di espresso) + «Giornata libera».
- **Vista Settimana**: resta la griglia con creazione a tocco/trascinamento; ripulita: fondo bianco, colonne a filetti, fuori disponibilità con tratteggio finissimo, blocchi con barretta + tinta, via pillola «Oggi» e viola degli esami. Tocco sull'intestazione del giorno → vista Giorno.
- **Creare**: «+» nero clay → FormSheet «Nuovo» con 6 voci solo testo (titolo + riga di spiegazione). In più tocco su buco libero (Giorno) o spazio vuoto (Settimana) → foglio «Prenota | Blocca».
- **Titolare**: nella vista Giorno guide raggruppate per istruttore con intestazione fissa, ricerca oltre 5 istruttori.

## Icone

- **Via tutte le 18 Fluent.** Lato istruttore/titolare → testo e gerarchia, nessuna icona. Lato allievo/Allievi → stesso posto, file sostituito con un'icona Gemini (impaginazione invariata). Poi si cancellano i `fluent-*.png`.
- **Da generare** (prompt §0.4, stesse luci e materiale delle 15 approvate, premium, mai infantili — nota 6):
  - morale/stati vuoti: tazzina di espresso fumante («Giornata libera»), aeroplanino di carta posato («Nessuna notifica»), piantina in vasetto («Nessun luogo/veicolo»), piccolo trofeo (traguardo ore di guida);
  - funzionale: tocco da laurea con cartello «P» (testata foglio esame);
  - sostituzioni allievo/Allievi: moto, bandiera a scacchi, due persone, calendario, segnaposto, frecce di scambio, edificio, blocco note, campanella.

## Ordine di lavoro (commit + anteprime ritagliate per fase)

0. Basi: primitivi clay mancanti (righe/sezioni, interruttore, campo, stato vuoto); verifica FormSheet lungo + Android; generazione icone.
1. Agenda: Giorno, Settimana, foglio «Nuovo», prenota/blocca.
2. ~30 fogli dell'Agenda su FormSheet + clay (via il rimbalzo in gestisci guida).
3. Disponibilità e fogli.
4. Tu e sottosezioni, Impostazioni, Panoramica istruttori (fogli a mano → FormSheet).
5. Resto: notifiche, scambi, inviti, home titolare; sostituzione file Fluent e cancellazione asset.
6. Documentazione: design-system, feature, impact-map, questo piano.

## Rischi e decisioni (prese stanotte)

- Colore dei blocchi: ~~barretta + tinta leggerissima~~ → dal 29/10 fondo pieno pastello, senza bordo, ombra in tinta (`AGENDA_BLOCK_BAR = false`).
- ~~Vista Giorno predefinita~~ → dal 29/10 solo vista Settimana.
- Allievi: si cambiano solo i file icona Fluent.
- Android: form sheet lunghi tagliavano la CTA → verifica in fase 0.
- Dati su prod (nota 4): solo Autoscuola Maltese; nessuna azione che manda notifiche/mail/WhatsApp a persone vere; si cancella tutto ciò che si crea.
- Account titolare (nota 5): `tiziano.difelice@reglo.it`; se non entra, verifica nel codice e segnalazione.
- Fuori perimetro: codice morto (`src/navigation`, `InstructorManageScreen`, `Badge`, `NativePageSheet`) e le 21 chiamate di disponibilità.
- Contesto: stop a fine fase oltre il 45%.


## Decisioni da confermare (per Tiziano)

1. **Blu in agenda — CHIUSA (29/10).** Decisione di Tiziano: «i colori devono rispettare i setting Aspetto agenda nelle impostazioni dell'autoscuola». La regola che rendeva neutri i blu sul telefono è stata tolta: i blocchi usano esattamente il colore scelto in «Aspetto agenda», blu e azzurri compresi, a fondo pastello pieno. Tolta anche la nota in «Aspetto agenda».
2. **Vista del titolare non provata sullo schermo.** Non ho fatto logout dal simulatore per non toccare la tua sessione. L'agenda raggruppata per istruttore e la Panoramica istruttori le ho controllate solo nel codice.
3. **Esito d'esame.** «Idoneo» e «Respinto» ora sono scritti in nero, senza verde e rosso. Sul web restano colorati.
4. **«Esci».** Ora sta solo nella schermata «Tu». Dalle Impostazioni è stato tolto per non averlo due volte.
5. **Android.** Non l'ho provato stanotte. Da controllare soprattutto i fogli lunghi e la tastiera in «Aggiungi luogo».
6. **La X dei fogli.** Fatto: ora titolo e X restano fissi in alto, il contenuto scorre sotto. Da confermare che ti piace così.
7. **Due difetti vecchi, non toccati** (era un lavoro solo di grafica):
   - togliendo un allievo da una guida di gruppo, la lista si aggiorna prima che il server risponda;
   - nella Panoramica istruttori, scegliendo un istruttore gli altri restano con lo stato vecchio.

## Cosa provare sul simulatore

1. **Agenda:** si apre sulla Settimana. Scorri a destra e a sinistra tra le settimane e torna con «Oggi»; guarda i blocchi a fondo pastello.
2. **Spazio libero:** tocca uno spazio vuoto della griglia, poi «Scegli i dettagli»: si apre «Prenota guida» con l'orario già messo. Chiudi senza prenotare.
3. **Una guida:** aprila e scorri fino in fondo. Titolo e X devono restare fissi in alto.
4. **Il «+»:** apri il foglio «Nuovo» e prova «Esame» o «Blocca un orario» senza salvare.
5. **Disponibilità:** dall'orologio in alto apri la schermata e tocca «Lunedì».
6. **Tu:** apri Ore di guida, Veicoli, Luoghi, Pagellino, Aspetto agenda e Impostazioni.
7. **Notifiche:** apri la campanella e torna indietro con la freccia.

## Fuori dal perimetro (restano com'erano)
Sezione Allievi (solo file icona cambiati), schermate allievo (idem), codice morto (`src/navigation`, `InstructorManageScreen`, `Badge`, `NativePageSheet`), fogli `settings/` dell'allievo.
