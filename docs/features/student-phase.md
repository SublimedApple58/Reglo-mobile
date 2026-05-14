# Student Phase — UX mobile per fase del percorso

L'app cambia completamente in base alla fase dell'allievo (`TEORIA` / `PRATICA` / `PATENTATO`). La fase è gestita lato web dal titolare (vedi `reglo/docs/features/student-phase.md`).

## File chiave

| Scope | File |
|------|------|
| Tipi | `src/types/regloApi.ts` (`AutoscuolaStudentPhase`, `StudentPhasePayload`) |
| Service | `src/services/regloApi.ts` → `getMyPhase()` |
| Query hook | `src/hooks/queries/useMyPhase.ts` |
| Hook UX | `src/hooks/useStudentPhase.ts` (espone `phase`, `theoryExamAt`, `drivingExamAt`) |
| Tab routing condizionale | `app/(tabs)/_layout.tsx` |
| Switch home per fase | `src/screens/RoleHomeScreen.tsx` |
| Home TEORIA | `src/screens/AllievoTheoryHomeScreen.tsx` |
| Home PRATICA (esistente, esteso) | `src/screens/AllievoHomeScreen.tsx` (header con `PhaseProgressBar compact`) |
| Schermata PATENTATO | `src/screens/AllievoLicensedScreen.tsx` |
| Componente progress bar | `src/components/PhaseProgressBar.tsx` |
| Notifiche kinds | `src/types/notifications.ts` (`theory_exam_countdown`, `theory_quiz_inactivity`) |
| Inbox rendering | `src/screens/NotificationInboxScreen.tsx` |

## Comportamento per fase

| Fase | Home | Tabs visibili | Booking guida |
|------|------|---------------|---------------|
| TEORIA | `AllievoTheoryHomeScreen` (riepilogo + progress bar 3 step + countdown + CTA quiz) | `home`, `quiz` (se quizEnabled azienda), eventuali `notes` se abilitato | Bloccato server-side |
| PRATICA | `AllievoHomeScreen` esistente + `PhaseProgressBar compact` in cima | `home`, `payments` (se autoPayments), `swaps` (se enabled), `notes` (se enabled), `settings` | Disponibile |
| PATENTATO | `AllievoLicensedScreen` (saluto + progress bar 100% + logout) | Solo `home` | Bloccato (fase nascosta in app) |

## Progress bar (`PhaseProgressBar`)

- 3 checkpoint orizzontali: Teoria → Foglio rosa → Patente.
- Track riempito secondo la fase corrente:
  - `TEORIA + theoryExamAt presente`: progress dentro il primo segmento, scala lineare con esame fra 30 giorni → 0%, esame oggi → 33% globale (100% del segmento Teoria).
  - `TEORIA + nessuna data esame`: ~1.7% globale (5% del primo segmento, valore base).
  - `PRATICA`: 50% globale.
  - `PATENTATO`: 100% globale.
- Variante `compact` per la home PRATICA (paddings ridotti, label più piccola).

## Home TEORIA

Costruita con la skill `/ui-ux-pro-max`:

1. **Header**: saluto personale ("Ciao, {nome}") + sottotitolo "Stai preparando l'esame di teoria".
2. **Progress card** con `PhaseProgressBar` 3-step.
3. **Countdown card** se `theoryExamAt` presente: data formattata + badge giorni residui in pink. Altrimenti banner informativo.
4. **Milestone card** con CTA contestuale (cambia in base ai giorni mancanti):
   - >30gg: "Avvia simulazione"
   - 8-30gg: "Apri capitoli"
   - 2-7gg: "Avvia simulazione" / "Settimana decisiva"
   - ≤1gg: "Rivedi i tuoi errori"
5. **Shortcut row**: "Simulazione" + "Capitoli".

## Schermata PATENTATO

Schermata centrata: icona trofeo, titolo "Congratulazioni", `PhaseProgressBar` al 100%, bottone logout.

## Notifiche fase TEORIA

| Kind | Titolo | Quando |
|------|--------|--------|
| `theory_exam_countdown` | "Esame teoria fra N giorni" / "Esame teoria domani" | T-7, T-3, T-1 alle 10:00 locali |
| `theory_quiz_inactivity` | "Riprendi lo studio" | 18:00 locali se nessuna `QuizSession` negli ultimi 5gg |

Entrambe le push sono solo informative: arrivano nell'inbox, non aprono overlay.

## Connessioni

- → **Quiz Teoria**: la tab `quiz` è visibile solo in `phase === TEORIA`. CTA della home TEORIA collegano direttamente a `/(tabs)/quiz` e `/(tabs)/quiz/chapters`.
- → **Booking Flow**: in `TEORIA` la tab non c'è e il backend rifiuta `createBookingRequest`.
- → **Notifications**: aggiunti due nuovi kinds.
- → **Backend**: `GET /api/autoscuole/me`, `updateStudentPhase` server action.
