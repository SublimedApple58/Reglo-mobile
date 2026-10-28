# REG-639 notte — clay su tutta l'app istruttore/titolare

> Lavoro notturno del 28→29/10/2026, piano approvato (con note) da chi gestisce Tiziano.
> Branch `feat/reg-639-clay-ds`, worktree `reglo-mobile-worktrees/reg-639`. Commit locali per fase, niente push/OTA.
> Anteprime ritagliate per fase in `/tmp/hiro-anteprime/clay/notte/<sezione>/`.

## Cosa è stato fatto
_(aggiornato a fine di ogni fase)_

- [ ] Fase 0 — basi
- [ ] Fase 1 — Agenda
- [ ] Fase 2 — fogli dell'Agenda
- [ ] Fase 3 — Disponibilità
- [ ] Fase 4 — Tu
- [ ] Fase 5 — resto + Fluent
- [ ] Fase 6 — documentazione

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

- Colore dei blocchi: barretta + tinta leggerissima (nota 2), un solo punto nel codice per tornare indietro.
- Vista Giorno predefinita (nota 3), nuova, non il vecchio `DayItinerary`.
- Allievi: si cambiano solo i file icona Fluent.
- Android: form sheet lunghi tagliavano la CTA → verifica in fase 0.
- Dati su prod (nota 4): solo Autoscuola Maltese; nessuna azione che manda notifiche/mail/WhatsApp a persone vere; si cancella tutto ciò che si crea.
- Account titolare (nota 5): `tiziano.difelice@reglo.it`; se non entra, verifica nel codice e segnalazione.
- Fuori perimetro: codice morto (`src/navigation`, `InstructorManageScreen`, `Badge`, `NativePageSheet`) e le 21 chiamate di disponibilità.
- Contesto: stop a fine fase oltre il 45%.
