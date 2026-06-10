// License categories & transmission — mobile mirror of the backend taxonomy
// (reglo/lib/autoscuole/license.ts). Used by the vehicle form + list badges.
import type { LicenseCategory, Transmission } from '../types/regloApi';

export const LICENSE_CATEGORIES: LicenseCategory[] = ['B', 'AM', 'A1', 'A2', 'A'];
export const TRANSMISSIONS: Transmission[] = ['manual', 'automatic'];

export const LICENSE_CATEGORY_LABELS: Record<LicenseCategory, string> = {
  B: 'B (auto)',
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
