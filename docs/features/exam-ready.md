# Pronto per l'esame (exam-ready flag) — mobile

Segnale **interno** che marca gli allievi **PRATICA** come "pronti per l'esame". Su mobile lo imposta l'**istruttore** (e titolare) dal dettaglio allievo; nel picker di creazione esame i pronti sono differenziati. **Non vincola** la creazione dell'esame. Backend: `../reglo/docs/features/exam-ready.md`.

## Files

| File | Ruolo |
|------|-------|
| `src/types/regloApi.ts` | `AutoscuolaStudent` estende con `studentPhase`, `examReady`, `examReadyAt`. |
| `src/services/regloApi.ts` | `setStudentExamReady(studentId, ready)` → `PATCH /api/autoscuole/students/:id/exam-ready`. `getInstructorSettings().students` include `studentPhase`+`examReady`+`examReadyAt`. |
| `src/screens/StudentNotesDetailScreen.tsx` | Toggle "Pronto per l'esame" (`ToggleSwitch`, icona `FLUENT_GRADUATE`) — visibile solo se `studentPhase === 'PRATICA'`. Optimistic + rollback su errore. |
| `src/stores/examStudentsStore.ts` | `ExamStudentOption.examReady`. |
| `src/screens/CreateExamScreen.tsx` | `StudentItem.examReady`; carry dai due rami di `loadStudents`; picker ordinato pronti-in-cima. |
| `app/(tabs)/home/select-exam-students.tsx` | Badge verde "Pronto" nel `metaRow` + anello verde sull'avatar. |

## Note

- Permessi enforced lato backend (`setStudentExamReady`: istruttore + titolare + admin). Il dettaglio allievo è raggiunto solo da superfici istruttore/titolare.
- Solo-JS: **nessun modulo nativo** → rilascio via **OTA** (`--branch production`, iOS poi Android separati).
- Optimistic update come da regola: qui usiamo optimistic **con rollback** per il toggle (coerente col pattern esistente `updateStudentGroupLessonOptIn` nello stesso screen).

## Connessioni

- **Backend** `../reglo` — contratto tipi: `examReady`/`examReadyAt`/`studentPhase` su `AutoscuolaStudent` e nell'array `students` di `getInstructorSettings`.
- **Notes/Istruttore** — il toggle vive in `StudentNotesDetailScreen` accanto a "Guide di gruppo".
