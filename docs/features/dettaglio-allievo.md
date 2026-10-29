# Dettaglio allievo (foglio istruttore / titolare)

Il foglio che si apre toccando un allievo (tab Allievi, agenda). Form sheet nativo alto quanto il contenuto (`FORM_SHEET` + `FormSheet`), scorre da sé solo se supera lo schermo. CTA fissa in fondo: chiama + «Scrivi su WhatsApp».

## Ordine delle sezioni (Tiziano, 29/10/2026)

1. **Intestazione**: volto 88 pt, nome, patente in corso («B · Manuale · ha già A2»).
2. **Allievo**: telefono (tocco = chiama), email (tocco = mail), patenti già conseguite, luogo abituale. Skeleton a due righe finché carica.
3. **Da fare**: Pagamenti («N guide da pagare», solo in modalità manuale) + Impostazioni in una lista; esame in arrivo; **Prossime guide** (solo future, dalla più vicina, max 5 + «Vedi tutte»).
4. **Andamento**: scheda «Percorso» (solo con più percorsi, REG-458), tre numeri (guide fatte · pagellino · ore), pagellino apribile.
5. **Storico guide** per ultimo: solo guide già svolte, le **ultime 5** + riga «Vedi tutte (N)».

«Vedi tutte» apre il form sheet `lesson-history` (`?kind=past|upcoming`): FlatList virtualizzata, righe piatte sullo sfondo, stesse azioni della scheda.

## File

| File | Ruolo |
|------|-------|
| `src/screens/StudentNotesDetailScreen.tsx` | Il foglio: carica tutto all'apertura (`loadData`), divide prossime/storico, tiene handler e stato. Rotte `home/student-detail`, `notes/[studentId]`. |
| `src/components/student/LessonHistoryRow.tsx` | Riga guida in `memo`: data, istruttore · veicolo · tipo, esito esame, pagellino apribile (stato locale), chip Road, note + matita. Usata dalla scheda e dal foglio intero. |
| `src/screens/LessonHistorySheet.tsx` | Foglio «Tutte le guide» (`FormSheet list`). |
| `app/(tabs)/{home,notes}/lesson-history.tsx` | Route, registrata in entrambi gli stack (`FORM_SHEET`). |
| `src/stores/lessonHistoryStore.ts` | Seed del foglio: elenchi + handler. La scheda lo ripubblica a ogni ricarica, così il foglio aperto si aggiorna dopo un salvataggio. |

## Regole

- Fluidità §15 del design system: niente transizioni di layout né `key` che rimontano lo storico; solo dissolvenze 180 ms; nessun fetch al tocco (i dati sono quelli del caricamento).
- Nuove azioni sulle guide vanno in `LessonHistoryRow` e negli handler della scheda (`openDetails`, `recordOutcome`, `openRoad`), passati anche dal seed: così valgono in scheda e in «Vedi tutte».
- Data di nascita e altri dati anagrafici non arrivano da `/api/autoscuole/students`: per mostrarli serve prima il backend.
