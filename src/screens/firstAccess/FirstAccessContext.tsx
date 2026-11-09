import React, { createContext, useContext, useMemo, useState } from 'react';
import type { FirstAccessStartResult } from '../../types/regloApi';

/**
 * Stato del «Primo accesso» (allievo creato dall'autoscuola col solo telefono):
 * vive nel layout dello stack `app/(auth)/first-access`, così i passi sono
 * schermate native separate (push e indietro di sistema) ma condividono i dati.
 * Il server riceve tutto in un colpo solo, all'ultimo passo.
 */
export type FirstAccessDraft = {
  start: FirstAccessStartResult | null;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** YYYY-MM-DD */
  birthDate: string | null;
};

const EMPTY: FirstAccessDraft = {
  start: null,
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  birthDate: null,
};

type Ctx = {
  draft: FirstAccessDraft;
  update: (patch: Partial<FirstAccessDraft>) => void;
};

const FirstAccessContext = createContext<Ctx | null>(null);

export function FirstAccessProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<FirstAccessDraft>(EMPTY);
  const value = useMemo<Ctx>(
    () => ({ draft, update: (patch) => setDraft((prev) => ({ ...prev, ...patch })) }),
    [draft],
  );
  return <FirstAccessContext.Provider value={value}>{children}</FirstAccessContext.Provider>;
}

export function useFirstAccess() {
  const ctx = useContext(FirstAccessContext);
  if (!ctx) throw new Error('useFirstAccess fuori da FirstAccessProvider');
  return ctx;
}

/** Ordine dei passi: guida la barra di avanzamento. */
export const FIRST_ACCESS_STEPS = ['index', 'name', 'email', 'password', 'birth', 'confirm'] as const;
export type FirstAccessStep = (typeof FIRST_ACCESS_STEPS)[number];

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/** `+393331234567` → `+39 333 123 4567` */
export function formatPhone(e164: string): string {
  if (e164.startsWith('+39') && e164.length >= 12) {
    const rest = e164.slice(3);
    return `+39 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  return e164;
}

/** `2007-03-14` → `14 marzo 2007` */
export function formatBirthDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
