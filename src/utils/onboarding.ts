import type { AutoscuolaRole, OnboardingStepKey, StudentOnboarding, UserPublic } from '../types/regloApi';
import { isStudent } from './roles';

/**
 * REG-802 — cosa deve completare l'allievo prima di entrare nelle tab.
 *
 * Lo decide il server (`onboarding` in `/api/mobile/me`). Con un backend
 * precedente al REG-802 il campo non c'è: si ripiega sulla regola del vecchio
 * PhoneGate (allievo senza cellulare → solo il cellulare), così l'app resta
 * corretta anche se arrivasse prima del backend.
 *
 * Dopo il login (che non porta `onboarding`) la sessione lo legge da `/me`
 * prima di aprirsi (`applyAuthPayload`).
 */
export function resolveOnboarding(
  me: { user: UserPublic; onboarding?: StudentOnboarding | null },
  role: AutoscuolaRole | null,
): StudentOnboarding | null {
  if (!isStudent(role)) return null;
  if (me.onboarding !== undefined) {
    const steps = (me.onboarding?.steps ?? []).filter((s) => ONBOARDING_SCREENS.includes(s.key));
    return steps.length ? { steps } : null;
  }
  return me.user.phone?.trim() ? null : { steps: [{ key: 'phone', required: true }] };
}

/**
 * Step che questa versione dell'app sa mostrare, nell'ordine. Uno step nuovo
 * del server che l'app non conosce viene saltato (il server lo richiederà a
 * un'app aggiornata).
 */
export const ONBOARDING_SCREENS: OnboardingStepKey[] = ['phone', 'availability'];

/** Rotta di uno step dentro `app/onboarding`. */
export const onboardingHref = (key: OnboardingStepKey) => `/onboarding/${key}` as const;
