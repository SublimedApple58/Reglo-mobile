// License categories & transmission — mobile mirror of the backend taxonomy
// (reglo/lib/autoscuole/license.ts). Used by the vehicle form + list badges.
import type { LicenseCategory, Transmission } from '../types/regloApi';

export const LICENSE_CATEGORIES: LicenseCategory[] = ['B', 'BE', 'C', 'CE', 'D', 'DE', 'AM', 'A1', 'A2', 'A'];
export const TRANSMISSIONS: Transmission[] = ['manual', 'automatic'];

export const LICENSE_CATEGORY_LABELS: Record<LicenseCategory, string> = {
  B: 'B (auto)',
  BE: 'BE (auto + rimorchio)',
  C: 'C (camion)',
  CE: 'CE (camion + rimorchio)',
  D: 'D (autobus)',
  DE: 'DE (autobus + rimorchio)',
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

// Motorcycle license categories — the "A" family only (B/BE/C/CE/D/DE are
// non-moto). Mirror of the backend `reglo/lib/autoscuole/license.ts`. Drives
// the moto-aware student experience (illustrations, tab icon, wording), keyed
// off the guide's vehicle category (fallback: the student's own category).
export const MOTO_LICENSE_CATEGORIES: LicenseCategory[] = ['AM', 'A1', 'A2', 'A'];

export const isMotoLicenseCategory = (c?: string | null): boolean =>
  !!c && (MOTO_LICENSE_CATEGORIES as string[]).includes(c);

/**
 * True when a vehicle of `vehicleCategory` is eligible for a student pursuing
 * `studentCategory`, applying the MOTO HIERARCHY AM < A1 < A2 < A: a moto
 * student may use any moto of category ≤ their own (A2 → A2/A1/AM, not A).
 * Non-moto categories (B/BE/C/CE/D/DE) have NO hierarchy — each only matches
 * itself; cross-class never matches.
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
  return false;
};

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
