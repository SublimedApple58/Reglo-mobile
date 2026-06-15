# Student Phase — UX mobile per fase del percorso

L'app cambia completamente in base alla fase dell'allievo: **AWAITING** → **TEORIA** → **PRATICA** → **PATENTATO**. La fase è gestita lato web dal titolare (vedi `reglo/docs/features/student-phase.md`).

## File chiave

| Scope | File |
|------|------|
| Tipi | `src/types/regloApi.ts` (`AutoscuolaStudentPhase`, `StudentPhasePayload`) |
| Service | `src/services/regloApi.ts` → `getMyPhase()` |
| Query hook | `src/hooks/queries/useMyPhase.ts` |
| Hook UX | `src/hooks/useStudentPhase.ts` (espone `phase`, `theoryExamAt`, `drivingExamAt`, `phasesEnabled`, `hasQuizAccess`, `autoAssignQuizOnSignup`) |
| Tab routing condizionale | `app/(tabs)/_layout.tsx` |
| Switch home per fase | `src/screens/RoleHomeScreen.tsx` |
| Home AWAITING | `src/screens/AllievoAwaitingScreen.tsx` (nuovo) |
| Home TEORIA | `src/screens/AllievoTheoryHomeScreen.tsx` |
| Home PRATICA | `src/screens/AllievoHomeScreen.tsx` (header con `PhaseProgressBar compact`) |
| Schermata PATENTATO | `src/screens/AllievoLicensedScreen.tsx` |
| Componente progress bar | `src/components/PhaseProgressBar.tsx` |
| Notifiche kinds | `src/types/notifications.ts` (`theory_exam_countdown`, `theory_quiz_inactivity`) |
| Inbox rendering | `src/screens/NotificationInboxScreen.tsx` |

## Comportamento per fase

| Fase | Home | Tabs visibili | Booking guida |
|------|------|---------------|---------------|
| AWAITING | `AllievoAwaitingScreen` (duck-clock + testo, nessuna CTA) | Solo `home` (niente settings, notes, swaps, quiz) | Bloccato server-side ("Il tuo percorso non è ancora stato attivato dall'autoscuola.") |
| TEORIA | `AllievoTheoryHomeScreen` (riepilogo + progress bar + countdown + CTA quiz) | `home`, `quiz` (solo se `hasQuizAccess`), eventuali `notes` se abilitato | Bloccato server-side ("Le lezioni di guida saranno disponibili dopo l'esame di teoria.") |
| PRATICA | `AllievoHomeScreen` + `PhaseProgressBar compact` in cima | `home`, `swaps` (se enabled), `notes` (se enabled), `settings` | Disponibile |
| PATENTATO | `AllievoLicensedScreen` (saluto + progress bar 100% + logout) | Solo `home` | Bloccato (fase nascosta in app) |

## Schema dati `/api/autoscuole/me`

```ts
{
  phase: AWAITING | TEORIA | PRATICA | PATENTATO,
  theoryExamAt: string | null,
  drivingExamAt: string | null,
  phasesEnabled?: ('TEORIA' | 'PRATICA')[],      // additive, default ['PRATICA']
  hasQuizAccess?: boolean,                       // derivato da quizSeatGrantedAt
  autoAssignQuizOnSignup?: boolean,              // read-only mobile
}
```

I tre campi opzionali sono additive per retro-compatibilità: client mobile vecchi che non li leggono continuano a funzionare e gli utenti restano nelle fasi esistenti (PRATICA / TEORIA / PATENTATO).

## Tab Quiz — visibilità

Visibile **solo** se:

```
isStudent && phase === 'TEORIA' && (hasQuizAccess || quizEnabled-legacy)
```

`hasQuizAccess` è il segnale canonico (deriva dal seat consumato a vita lato server). `quizEnabled` è un fallback difensivo per backend più vecchi.

In AWAITING e in PRATICA/PATENTATO la tab non è renderizzata e non è raggiungibile via deep link.

## Home AWAITING

Schermata neutra:

- Illustrazione: `duck-clock.png` in cerchio bianco (cornice surface + shadow soft)
- Titolo: "Ci siamo quasi, {firstName}" (o "Ci siamo quasi" senza nome)
- Sottotitolo: "Stai per iniziare il tuo percorso. La tua autoscuola attiverà l'accesso a breve. Riceverai una notifica appena sarà pronto."
- **Nessuna CTA**. L'allievo non ha azioni da compiere — è il titolare che lo attiva dal web.

## Home TEORIA

(invariata) Costruita con `/ui-ux-pro-max`:

1. Header: saluto + sottotitolo
2. Progress card con `PhaseProgressBar` 3-step
3. Countdown card se `theoryExamAt` presente
4. Milestone card con CTA contestuale (cambia in base ai giorni mancanti)
5. Shortcut row: "Simulazione" + "Capitoli"

## Schermata PATENTATO

(invariata) Centrata: icona trofeo + titolo "Congratulazioni" + progress 100% + logout.

## Progress bar (`PhaseProgressBar`)

3 checkpoint orizzontali: Teoria → Foglio rosa → Patente. Track riempito secondo la fase corrente. AWAITING attualmente non rappresentato nella progress bar (vive prima del checkpoint Teoria).

## Notifiche fase TEORIA

| Kind | Titolo | Quando |
|------|--------|--------|
| `theory_exam_countdown` | "Esame teoria fra N giorni" / "Esame teoria domani" | T-7, T-3, T-1 alle 10:00 locali |
| `theory_quiz_inactivity` | "Riprendi lo studio" | 18:00 locali se nessuna `QuizSession` negli ultimi 5gg |

Entrambe informative (inbox, niente overlay). AWAITING non ha reminder dedicati per ora.

## Connessioni

- → **Quiz Teoria**: tab visibile solo in `phase === TEORIA && hasQuizAccess`. CTA della home TEORIA → `/(tabs)/quiz`.
- → **Booking Flow**: in AWAITING e TEORIA la tab non c'è e il backend rifiuta `createBookingRequest`.
- → **Notifications**: due kinds (`theory_exam_countdown`, `theory_quiz_inactivity`).
- → **Backend**: `GET /api/autoscuole/me`, `POST /api/mobile/auth/student-register` (decide AWAITING/TEORIA/PRATICA in transaction), `updateStudentPhase` server action, `grantQuizSeat` (owner) per uscire da AWAITING.
