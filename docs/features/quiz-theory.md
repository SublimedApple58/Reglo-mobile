# Quiz Teoria Patente (Mobile)

Quiz ministeriali per la teoria della patente. Tab "Quiz" condizionale per studenti quando `quizEnabled` è attivo per la company.

## Feature Gate

- Hook: `src/hooks/useQuizEnabled.ts` — chiama `regloApi.getAutoscuolaSettings()`, legge `settings.quizEnabled`
- Tab visibile solo per `isStudent && quizEnabled`
- Pattern identico a `useStudentNotesEnabled`

## Screens

### QuizHomeScreen (`src/screens/QuizHomeScreen.tsx`)
- Due CTA affiancate: "Simulazione" (EXAM, gradient pink) e "Esercitazione" (PRACTICE, outline bianco)
- Stats card: readinessScore, examPassRate, totale esami
- Libreria Argomenti → avvia CHAPTER mode
- CTA "Rivedi Errori" → avvia REVIEW mode
- Sessioni recenti (ultime 5) con label differenziata per mode

### QuizSessionScreen (`src/screens/QuizSessionScreen.tsx`)
- Top bar: progresso, timer (EXAM), badge mode (Simulazione/Esercitazione/In corso)
- Card domanda con immagine opzionale
- Bottoni VERO/FALSO

**Comportamento per mode:**
| | EXAM (Simulazione) | PRACTICE (Esercitazione) | CHAPTER / REVIEW |
|---|---|---|---|
| Feedback | Nessuno, auto-advance dopo 350ms | Immediato (banner + hint) | Immediato (banner + hint) |
| Timer | 20 min | No | No |
| Auto-fail | > 3 errori → overlay "Simulazione terminata" | No | No |
| Score % | Nascosto | Visibile | Visibile |
| Pallini | Neutri (rosa chiaro, no verde/rosso) | Verde/rosso | Verde/rosso |
| Badge header | "Simulazione" (rosso) | "Esercitazione" (verde) | "In corso" (verde) |

### QuizResultsScreen (`src/screens/QuizResultsScreen.tsx`)
- Hero: pass/fail per EXAM, "Esercitazione completata" per PRACTICE (cerchio primary)
- Punteggio e tempo
- Breakdown per capitolo con progress bars
- Lista risposte sbagliate espandibili con hint
- Azioni: "Nuova simulazione" (EXAM) / "Nuova esercitazione" (PRACTICE), ripeti errori, torna alla home

## Routing

```
app/(tabs)/quiz/_layout.tsx  → Stack + QuizProvider
app/(tabs)/quiz/index.tsx    → QuizHomeScreen
app/(tabs)/quiz/session.tsx  → QuizSessionScreen
app/(tabs)/quiz/results.tsx  → QuizResultsScreen
```

## Context

`src/context/QuizContext.tsx` — tiene in memoria le domande della sessione corrente:
- `session`: `{ sessionId, questions[], mode, timeLimitSec, startedAt }`
- `startSession(data)`: salva sessione
- `clearSession()`: pulisce

## Types

In `src/types/regloApi.ts`:
- `QuizSessionMode`, `QuizChapterProgress`, `QuizQuestion`, `QuizQuestionWithAnswer`
- `StartQuizSessionInput`, `StartQuizSessionResult`
- `SubmitQuizAnswerResult`, `QuizSessionResult`, `QuizStudentStats`

## API Functions

In `src/services/regloApi.ts`:
- `getQuizChapters()`, `startQuizSession()`, `submitQuizAnswer()`
- `completeQuizSession()`, `abandonQuizSession()`
- `getQuizSessionResult()`, `getQuizStudentStats()`

## Dependencies

- `react-native-render-html` — rendering hint HTML

## Files

| File | Purpose |
|------|---------|
| `src/hooks/useQuizEnabled.ts` | Feature gate hook |
| `src/context/QuizContext.tsx` | Session state context |
| `src/screens/QuizHomeScreen.tsx` | Home screen |
| `src/screens/QuizSessionScreen.tsx` | Quiz session screen |
| `src/screens/QuizResultsScreen.tsx` | Results screen |
| `app/(tabs)/_layout.tsx` | Quiz tab (conditional) |
| `app/(tabs)/quiz/_layout.tsx` | Stack layout + QuizProvider |
| `app/(tabs)/quiz/index.tsx` | Route → QuizHomeScreen |
| `app/(tabs)/quiz/session.tsx` | Route → QuizSessionScreen |
| `app/(tabs)/quiz/results.tsx` | Route → QuizResultsScreen |
| `src/types/regloApi.ts` | Quiz types |
| `src/services/regloApi.ts` | Quiz API functions |

## Connected Features

- **Settings**: reads `quizEnabled` from company settings
- **Backend**: all quiz data from `reglo/` API routes
