import React, { createContext, useCallback, useContext, useState } from 'react';
import type { QuizQuestionWithAnswer, QuizSessionMode } from '../types/regloApi';

type QuizSessionState = {
  sessionId: string;
  questions: QuizQuestionWithAnswer[];
  mode: QuizSessionMode;
  timeLimitSec: number | null;
  startedAt: number; // Date.now()
  schedaNumber?: number;
  chapterId?: string;
  schedaId?: string;
  chapterDescription?: string;
} | null;

type QuizContextValue = {
  session: QuizSessionState;
  startSession: (data: {
    sessionId: string;
    questions: QuizQuestionWithAnswer[];
    mode: QuizSessionMode;
    timeLimitSec: number | null;
    schedaNumber?: number;
    chapterId?: string;
    schedaId?: string;
    chapterDescription?: string;
  }) => void;
  clearSession: () => void;
};

const QuizContext = createContext<QuizContextValue | null>(null);

export const QuizProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<QuizSessionState>(null);

  const startSession = useCallback(
    (data: {
      sessionId: string;
      questions: QuizQuestionWithAnswer[];
      mode: QuizSessionMode;
      timeLimitSec: number | null;
      schedaNumber?: number;
      chapterId?: string;
      schedaId?: string;
      chapterDescription?: string;
    }) => {
      setSession({ ...data, startedAt: Date.now() });
    },
    [],
  );

  const clearSession = useCallback(() => setSession(null), []);

  return (
    <QuizContext.Provider value={{ session, startSession, clearSession }}>
      {children}
    </QuizContext.Provider>
  );
};

export const useQuiz = () => {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error('useQuiz must be used within QuizProvider');
  return ctx;
};
