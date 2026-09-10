# Pagellino di valutazione (REG-443) — lato istruttore

L'autoscuola configura le voci del proprio pagellino dal web (Impostazioni → Pagellino);
l'app le mostra **dentro il foglio "Dettagli guida"**, sotto la valutazione complessiva.
Nessuna schermata nuova: l'istruttore apre il foglio, tocca le stelline che vuole
correggere e usa il "Salva" sticky già presente.

## File

| Cosa | Dove |
|---|---|
| Sezione Pagellino | `app/(tabs)/home/manage-lesson-details.tsx` |
| Stelline (N a scelta) | `src/components/StarRating.tsx` (prop `total`, default 5) |
| Punteggio di partenza + dimensione stelline | `src/utils/evaluationSheet.ts` |
| Tipi + chiamata | `src/types/regloApi.ts` (`EvaluationItem`, `AppointmentEvaluation`), `src/services/regloApi.ts` (`getAppointmentEvaluation`) |
| Salvataggio | `ManageLessonDetailsPayload.evaluations` → `IstruttoreHomeScreen.saveLessonDetails` e `StudentNotesDetailScreen` |

## Comportamento

- Il foglio carica pagellino e punteggi in **una sola chiamata** all'apertura
  (`GET /api/autoscuole/appointments/:id/evaluation`).
- Se l'autoscuola non ha il pagellino attivo (o la chiamata fallisce) la sezione **non
  compare** e il foglio resta identico a prima: tipo, stelle complessive, note.
- Le stelline partono da **metà scala** (3 su 5, 2 su 3) e valgono come punteggio anche
  se l'istruttore non le tocca: una guida valutata ha sempre il pagellino completo.
- Ritoccare la stellina già selezionata **non azzera** la voce (il pagellino non ha lo
  stato "non valutato", a differenza della valutazione complessiva).
- Le stelline sono **navy** come quelle della valutazione complessiva: il design system
  mobile è mono-navy, vedi `docs/design-system.md`.
- Scale possibili: 3 o 5 stelline (30px e 26px rispettivamente).
