import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queries/queryKeys';
import { regloApi } from '../../services/regloApi';
import { useSession } from '../../context/SessionContext';
import type {
  CompleteOnboardingInput,
  OnboardingStep,
  OnboardingStepKey,
  StudentAvailabilityBand,
  StudentRangeRules,
  StudentRangesByDay,
} from '../../types/regloApi';
import { ITALY } from '../../utils/phoneCountries';
import { phoneSubmitValue, phoneValueFrom, type PhoneValue } from '../../components/PhoneField';
import { onboardingHref } from '../../utils/onboarding';
import { DEFAULT_BANDS, payloadRanges } from '../../utils/studentAvailability';

/**
 * REG-802 — onboarding dell'allievo a sessione aperta: «primo accesso normale»
 * (nome, email, cellulare, disponibilità), cellulare mancante (era il
 * PhoneGate) o solo le disponibilità. Gli step li decide il server
 * (`onboarding` in `/me`); qui vivono i dati raccolti, condivisi fra le
 * schermate dello stack `app/onboarding`, e il salvataggio, che avviene in un
 * colpo solo alla fine (`POST /api/autoscuole/me/onboarding`).
 */
export type OnboardingDraft = {
  firstName: string;
  lastName: string;
  phone: PhoneValue;
  /** null = non scelte (o rimandate con «Configura in seguito»). */
  days: StudentRangesByDay | null;
  /** Le fasce possibili, dal server (lette dallo step Disponibilità). */
  bands: StudentAvailabilityBand[] | null;
  /** REG-813 — regole di «Un orario preciso», dal server. */
  rules: StudentRangeRules | null;
};

type Ctx = {
  steps: OnboardingStep[];
  /** C'è il riepilogo «Tutto giusto?» (primo accesso normale). */
  hasConfirm: boolean;
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  /** Avanzamento di uno step (null = flusso di un passo: niente linea). */
  positionOf: (key: OnboardingStepKey | 'confirm') => { index: number; total: number } | null;
  /** Primo passo: niente «indietro» (il flusso è bloccante). */
  isFirst: (key: OnboardingStepKey | 'confirm') => boolean;
  stepOf: (key: OnboardingStepKey) => OnboardingStep | undefined;
  /** Va al passo dopo, oppure salva se era l'ultimo. */
  next: (from: OnboardingStepKey, patch?: Partial<OnboardingDraft>) => Promise<void>;
  /** Salva tutto e chiude l'onboarding. */
  submit: (patch?: Partial<OnboardingDraft>) => Promise<void>;
  submitting: boolean;
  submitError: string | null;
  clearSubmitError: () => void;
  /** «Momento caldo» finale del primo accesso normale (gestito dal riepilogo). */
  welcomeName: string | null;
  /** Disponibilità lette dal server (o il ripiego): lo step può mostrarle. */
  availabilityLoaded: boolean;
};

const OnboardingContext = createContext<Ctx | null>(null);

const splitName = (full: string | null | undefined) => {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  // «sara conti» → «Sara», «Conti»: l'autoscuola a volte scrive tutto minuscolo.
  const cap = (w: string) => (w ? w[0].toLocaleUpperCase('it-IT') + w.slice(1) : w);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: cap(parts[0]), lastName: '' };
  return { firstName: cap(parts[0]), lastName: parts.slice(1).map(cap).join(' ') };
};

export const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { onboarding, user, setOnboarding, refreshMe, activeCompanyId } = useSession();
  const queryClient = useQueryClient();
  // Gli step si fissano all'apertura: mentre l'allievo li percorre la sessione
  // può aggiornarsi, il flusso no.
  const [steps] = useState<OnboardingStep[]>(() => onboarding?.steps ?? []);
  const hasConfirm = steps.some((s) => s.key === 'name');
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    ...splitName(user?.name),
    phone: user?.phone ? phoneValueFrom(user.phone) : { country: ITALY, text: '' },
    days: null,
    bands: null,
    rules: null,
  }));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => {
      const nextDraft = { ...prev, ...patch };
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }, []);

  // Le disponibilità (salvate e fasce possibili) si leggono all'apertura
  // dell'onboarding: quando si arriva allo step la settimana c'è già (§15).
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  useEffect(() => {
    if (!steps.some((st) => st.key === 'availability')) return;
    let alive = true;
    regloApi
      .getMyAvailability()
      .then((data) => {
        if (alive) update({ bands: data.bands, rules: data.rules ?? null, days: draftRef.current.days ?? payloadRanges(data) });
      })
      .catch(() => {
        if (alive) update({ bands: DEFAULT_BANDS, days: draftRef.current.days ?? {} });
      })
      .finally(() => alive && setAvailabilityLoaded(true));
    return () => {
      alive = false;
    };
  }, [steps, update]);

  const total = steps.length + (hasConfirm ? 1 : 0);
  const keys = useMemo(() => steps.map((s) => s.key), [steps]);
  const positionOf = useCallback(
    (key: OnboardingStepKey | 'confirm') => {
      if (total <= 1) return null;
      const index = key === 'confirm' ? steps.length : keys.indexOf(key);
      return { index: Math.max(index, 0), total };
    },
    [keys, steps.length, total],
  );
  const isFirst = useCallback((key: OnboardingStepKey | 'confirm') => keys[0] === key, [keys]);
  const stepOf = useCallback((key: OnboardingStepKey) => steps.find((s) => s.key === key), [steps]);

  const submit = useCallback(
    async (patch?: Partial<OnboardingDraft>) => {
      if (patch) update(patch);
      const d = { ...draftRef.current, ...patch };
      const due = new Set(keys);
      const input: CompleteOnboardingInput = {};
      if (due.has('name')) {
        input.firstName = d.firstName.trim();
        input.lastName = d.lastName.trim();
      }
      if (due.has('phone') && d.phone.text.trim()) input.phone = phoneSubmitValue(d.phone);
      if (due.has('availability') && d.days) input.availability = { ranges: d.days };
      setSubmitError(null);
      setSubmitting(true);
      try {
        const result = await regloApi.completeOnboarding(input);
        if (input.availability) {
          queryClient.invalidateQueries({ queryKey: queryKeys.studentAvailability(activeCompanyId) });
        }
        // Si rilegge `/me`: nome e cellulare nuovi in sessione (card del
        // Profilo, saluto della home) e gli step rimasti; se non risponde
        // bastano quelli del salvataggio.
        const close = () =>
          refreshMe().catch(() => setOnboarding(result.onboarding ?? null));
        if (hasConfirm) {
          // Il riepilogo mostra «Eccoti, Sara» e poi chiude lui.
          setWelcomeName(input.firstName || d.firstName || null);
          setTimeout(close, 1400);
        } else {
          await close();
        }
      } catch (error) {
        setSubmitError(errorText(error, 'Non siamo riusciti a salvare. Riprova.'));
      } finally {
        setSubmitting(false);
      }
    },
    [activeCompanyId, hasConfirm, keys, queryClient, refreshMe, setOnboarding, update],
  );

  const next = useCallback(
    async (from: OnboardingStepKey, patch?: Partial<OnboardingDraft>) => {
      if (patch) update(patch);
      const i = keys.indexOf(from);
      const following = keys[i + 1];
      if (following) {
        router.push(onboardingHref(following));
        return;
      }
      if (hasConfirm) {
        router.push('/onboarding/confirm');
        return;
      }
      await submit(patch);
    },
    [hasConfirm, keys, router, submit, update],
  );

  const value = useMemo<Ctx>(
    () => ({
      steps,
      hasConfirm,
      draft,
      update,
      positionOf,
      isFirst,
      stepOf,
      next,
      submit,
      submitting,
      submitError,
      clearSubmitError: () => setSubmitError(null),
      welcomeName,
      availabilityLoaded,
    }),
    [steps, hasConfirm, draft, update, positionOf, isFirst, stepOf, next, submit, submitting, submitError, welcomeName, availabilityLoaded],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding fuori da OnboardingProvider');
  return ctx;
}
