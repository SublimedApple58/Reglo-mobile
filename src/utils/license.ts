// License categories & transmission — mobile mirror of the backend taxonomy
// (reglo/lib/autoscuole/license.ts). Used by the vehicle form + list badges.
import type { LicenseCategory, Transmission } from '../types/regloApi';

export const LICENSE_CATEGORIES: LicenseCategory[] = ['B', 'BE', 'AMQ', 'B1', 'C', 'CE', 'D', 'DE', 'AM', 'A1', 'A2', 'A'];
export const TRANSMISSIONS: Transmission[] = ['manual', 'automatic'];

// License paths a self-registered student can pick for themselves at first
// access (REG-410) — mirror of reglo/lib/autoscuole/license.ts. Everyday car +
// the moto "A" family; pro/trailer categories stay staff-only. Order = display.
export const STUDENT_LICENSE_CATEGORIES: LicenseCategory[] = ['B', 'AMQ', 'B1', 'AM', 'A1', 'A2', 'A'];

export const LICENSE_CATEGORY_LABELS: Record<LicenseCategory, string> = {
  B: 'B (auto)',
  BE: 'BE (auto + rimorchio)',
  C: 'C (camion)',
  CE: 'CE (camion + rimorchio)',
  D: 'D (autobus)',
  DE: 'DE (autobus + rimorchio)',
  AMQ: 'AM quadriciclo (microcar)',
  B1: 'B1 (quadriciclo pesante)',
  AM: 'AM (ciclomotore)',
  A1: 'A1 (125)',
  A2: 'A2 (media)',
  A: 'A (moto)',
};

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  manual: 'Manuale',
  automatic: 'Automatico',
};

export const transmissionLabel = (value: string | null | undefined): string =>
  value ? TRANSMISSION_LABELS[value as Transmission] ?? value : '';

// Friendly label for a vehicle/student license category (e.g. "A1 (125)").
// Falls back to the raw value; empty string when absent.
export const licenseCategoryLabel = (value: string | null | undefined): string =>
  value ? LICENSE_CATEGORY_LABELS[value as LicenseCategory] ?? value : '';

// Motorcycle license categories — the "A" family only (B/BE/C/CE/D/DE e i
// quadricicli AMQ/B1 sono non-moto: quattro ruote, e la gerarchia qui sotto
// darebbe una microcar a un allievo della A). Mirror of the backend
// `reglo/lib/autoscuole/license.ts`. Drives
// the moto-aware student experience (illustrations, tab icon, wording), keyed
// off the guide's vehicle category (fallback: the student's own category).
export const MOTO_LICENSE_CATEGORIES: LicenseCategory[] = ['AM', 'A1', 'A2', 'A'];

export const isMotoLicenseCategory = (c?: string | null): boolean =>
  !!c && (MOTO_LICENSE_CATEGORIES as string[]).includes(c);

/**
 * Motrice di ogni categoria con rimorchio (REG-507, specchio del web): un
 * rimorchio non è un veicolo guidabile, il corso CE si fa sul camion C.
 */
const TRAILER_CATEGORY_MOTRICE: Record<string, string> = {
  BE: 'B',
  C1E: 'C1',
  CE: 'C',
  D1E: 'D1',
  DE: 'D',
};

/**
 * Mezzi su cui si fanno le qualificazioni (REG-507, REG-766): la CQC merci
 * (sigla `CQC`) su camion C o C1, la CQC persone (`CQCP`) su autobus D o
 * minibus D1, l'ADR sul camion C. Specchio di `QUALIFICATION_BASE_VEHICLES`
 * in reglo/lib/autoscuole/license.ts.
 */
const QUALIFICATION_BASE_VEHICLES: Record<string, readonly string[]> = {
  CQC: ['C', 'C1'],
  CQCP: ['D', 'D1'],
  ADR: ['C'],
};

/**
 * True when a vehicle of `vehicleCategory` is eligible for a student pursuing
 * `studentCategory` — mirror of the backend:
 *   MOTO:    AM < A1 < A2 < A (a moto of category ≤ the student's own)
 *   TRAILER: the motrice of a trailer category (CE → C, DE → D, BE → B, …)
 *   QUALIF.: CQC merci → C/C1 · CQC persone → D/D1 · ADR → C
 * All one way only: a C student may not use a CE- or CQC-marked vehicle.
 * Cross-class never matches. Same category always matches.
 */
export const licenseCategoryEligible = (
  vehicleCategory: string,
  studentCategory: string,
): boolean => {
  if (vehicleCategory === studentCategory) return true;
  const vMoto = isMotoLicenseCategory(vehicleCategory);
  const sMoto = isMotoLicenseCategory(studentCategory);
  if (vMoto && sMoto) {
    return (
      (MOTO_LICENSE_CATEGORIES as string[]).indexOf(vehicleCategory) <=
      (MOTO_LICENSE_CATEGORIES as string[]).indexOf(studentCategory)
    );
  }
  if (TRAILER_CATEGORY_MOTRICE[studentCategory] === vehicleCategory) return true;
  if (QUALIFICATION_BASE_VEHICLES[studentCategory]?.includes(vehicleCategory)) return true;
  return false;
};

/**
 * Nome breve per lo schermo: le patenti restano la sigla («B», «CE»), le due
 * CQC hanno il nome — «CQCP» non lo legge nessuno, e «CQC» da sola non dice
 * più quale delle due (REG-766).
 */
const LICENSE_CATEGORY_SHORT: Record<string, string> = {
  CQC: 'CQC merci',
  CQCP: 'CQC persone',
};

export const licenseCategoryShort = (value: string | null | undefined): string =>
  value ? LICENSE_CATEGORY_SHORT[value] ?? value : '';

/**
 * Il percorso dentro una frase: «patente C», «CQC persone». Sulle qualificazioni
 * «patente» sarebbe falso.
 */
export const pathNoun = (category: string): string =>
  category in QUALIFICATION_BASE_VEHICLES
    ? licenseCategoryShort(category)
    : `patente ${category}`;

/** Lo stesso a inizio riga: «Patente C», «CQC persone». */
export const pathPhrase = (category: string): string =>
  category in QUALIFICATION_BASE_VEHICLES
    ? licenseCategoryShort(category)
    : `Patente ${category}`;

/**
 * True when a vehicle's (category, transmission) serves a student's pursued
 * license. Category uses the moto hierarchy; transmission must match exactly.
 * Null/absent on either side is permissive (never blocks).
 */
export const vehicleServesStudent = (
  vehicle: { licenseCategory?: string | null; transmission?: string | null },
  student: { licenseCategory?: string | null; transmission?: string | null },
): boolean => {
  if (!student.licenseCategory || !student.transmission) return true;
  if (!vehicle.licenseCategory || !vehicle.transmission) return true;
  if (vehicle.transmission !== student.transmission) return false;
  return licenseCategoryEligible(vehicle.licenseCategory, student.licenseCategory);
};
