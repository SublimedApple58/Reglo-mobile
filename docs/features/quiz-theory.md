# Quiz Teoria Patente (Mobile)

Quiz ministeriali per la teoria della patente. Tab "Quiz" condizionale per studenti quando `quizEnabled` è attivo per la company.

## Feature Gate

- Hook: `src/hooks/useQuizEnabled.ts` — chiama `regloApi.getAutoscuolaSettings()`, legge `settings.quizEnabled`
- Tab visibile solo per `isStudent && quizEnabled`
- Pattern identico a `useStudentNotesEnabled`

## Screens

### QuizHomeScreen (`src/screens/QuizHomeScreen.tsx`)
- Stats card: readinessScore, examPassRate, totale esami
- CTA "Simulazione Esame" → avvia EXAM mode
- Lista 25 capitoli con progress bar → avvia CHAPTER mode
- CTA "Rivedi Errori" → avvia REVIEW mode
- Sessioni recenti (ultime 5)

### QuizSessionScreen (`src/screens/QuizSessionScreen.tsx`)
- Top bar: progresso, timer (EXAM), contatori correct/wrong
- Card domanda con immagine opzionale
- Bottoni VERO/FALSO
- Feedback dopo risposta: corretto/sbagliato + hint HTML
- Auto-fail se > 3 errori (EXAM)
- Hint renderizzato con `react-native-render-html`

### QuizResultsScreen (`src/screens/QuizResultsScreen.tsx`)
- Hero pass/fail
- Punteggio e tempo
- Breakdown per capitolo con progress bars
- Lista risposte sbagliate espandibili con hint
- Azioni: nuova simulazione, ripeti errori, torna alla home

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
