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
| Home PRATICA | `src/screens/AllievoHomeScreen.tsx` |
| Schermata PATENTATO | `src/screens/AllievoLicensedScreen.tsx` |
| Componente timeline percorso | `src/components/PhaseTimeline.tsx` (verticale, 4 step) — usato in `AllievoAwaitingScreen` |
| Icone 3D percorso | `assets/icons-3d/` (rocket, clock, notebook, file-text, license — 3dicons.co clay, tinta navy, CC0) |
| Notifiche kinds | `src/types/notifications.ts` (`theory_exam_countdown`, `theory_quiz_inactivity`) |
| Inbox rendering | `src/screens/NotificationInboxScreen.tsx` |

## Comportamento per fase

| Fase | Home | Tabs visibili | Booking guida |
|------|------|---------------|---------------|
| AWAITING | `AllievoAwaitingScreen` (hero razzo 3D + timeline percorso, nessuna CTA) | Solo `home` (niente settings, notes, swaps, quiz) | Bloccato server-side ("Il tuo percorso non è ancora stato attivato dall'autoscuola.") |
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

Schermata neutra, redesign stile Airbnb (mono-navy), scrollabile:

- **Hero**: icona 3D clay `rocket.png` (tinta navy) che fluttua con ombra soft — niente più cornice/cerchio bianco, niente paperotto.
- **Titolo**: "Ci siamo quasi, {firstName}" (o "Ci siamo quasi" senza nome), weight 600.
- **Sottotitolo**: "Stai per iniziare il tuo percorso. La tua autoscuola attiverà l'accesso a breve: ti avviseremo appena sarà pronto."
- **Card "IL TUO PERCORSO"**: `PhaseTimeline` verticale (vedi sotto).
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

## Timeline percorso (`PhaseTimeline`)

Timeline **verticale a itinerario** (stile Airbnb), 4 step con icona 3D clay (tinta navy) + titolo + sottotitolo:

| Step | Icona | Sottotitolo |
|------|-------|-------------|
| In attesa | `clock.png` | Stiamo attivando il tuo accesso |
| Teoria | `notebook.png` | Quiz e lezioni per l'esame di teoria |
| Foglio rosa | `file-text.png` | Inizi le guide in auto |
| Patente | `license.png` | Pronto a metterti al volante |

Lo step corrispondente a `phase` è "active" (anello navy + pill "In corso"); gli step precedenti "done" (connettore navy), i successivi "future" (smorzati). In AWAITING l'attivo è "In attesa".

> Nota: `PhaseProgressBar` (vecchio stepper orizzontale 3-step) è stato **rimosso** — era importato solo da questa schermata. Le sezioni TEORIA/PATENTATO qui sotto descrivono il design di prodotto previsto; verificare nel codice il componente progress effettivamente usato da quelle schermate.

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
