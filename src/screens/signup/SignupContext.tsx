import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useSession } from '../../context/SessionContext';
import type { SignupSchool } from '../../types/regloApi';
import { ITALY } from '../../utils/phoneCountries';
import { phoneSubmitValue, type PhoneValue } from '../../components/PhoneField';

/**
 * REG-812 — registrazione dell'allievo a passi (stack `app/(auth)/signup`):
 * stesso scheletro del Primo accesso, una domanda per schermata. Si parte dal
 * codice di invito, si vede subito la propria autoscuola, poi nome, email,
 * cellulare, password e il riepilogo «Tutto giusto?», dove nasce l'account
 * (`POST /api/mobile/auth/student-register`, in un colpo solo).
 * Patente e disponibilità arrivano dopo, dall'onboarding deciso dal server.
 */
export type SignupDraft = {
  code: string;
  /** L'autoscuola del codice, dal server (null finché il codice non è verificato). */
  school: SignupSchool | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: PhoneValue;
  password: string;
};

const EMPTY: SignupDraft = {
  code: '',
  school: null,
  firstName: '',
  lastName: '',
  email: '',
  phone: { country: ITALY, text: '' },
  password: '',
};

/** Ordine dei passi: guida la linea di avanzamento. */
export const SIGNUP_STEPS = ['index', 'school', 'name', 'email', 'phone', 'password', 'confirm'] as const;
export type SignupStep = (typeof SIGNUP_STEPS)[number];
export const signupProgress = (step: SignupStep) => ({ index: SIGNUP_STEPS.indexOf(step), total: SIGNUP_STEPS.length });

export const CODE_LENGTH = 6;

type Ctx = {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
  /** Crea l'account: a buon fine la sessione si apre e l'AuthGate porta avanti. */
  submit: () => Promise<void>;
  submitting: boolean;
  submitError: string | null;
};

const SignupContext = createContext<Ctx | null>(null);

export const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const { signUp } = useSession();
  const [draft, setDraft] = useState<SignupDraft>(EMPTY);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<SignupDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const submit = useCallback(async () => {
    const d = draftRef.current;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await signUp({
        name: `${d.firstName.trim()} ${d.lastName.trim()}`,
        email: d.email.trim(),
        phone: phoneSubmitValue(d.phone),
        password: d.password,
        confirmPassword: d.password,
        schoolCode: d.code,
        // REG-500: il consenso è scritto sotto il campo del cellulare.
        whatsappConsent: true,
      });
    } catch (error) {
      setSubmitError(errorText(error, 'Non siamo riusciti a creare il tuo account. Riprova.'));
      setSubmitting(false);
    }
    // A buon fine `submitting` resta vero: la schermata sta per essere sostituita.
  }, [signUp]);

  const value = useMemo<Ctx>(
    () => ({ draft, update, submit, submitting, submitError }),
    [draft, update, submit, submitting, submitError],
  );
  return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignup() {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error('useSignup fuori da SignupProvider');
  return ctx;
}
