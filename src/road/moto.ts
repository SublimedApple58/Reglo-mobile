import { isMotoLicenseCategory } from '../utils/license';

/**
 * REG-753 — guida moto in Road: l'allievo è in moto, l'istruttore lo segue
 * nell'auto al seguito col telefono. Lo dice la patente del veicolo della guida
 * (AM/A1/A2/A). Solo grafica: quadrante al posto della velocità, moto sulla mappa.
 */
export const isMotoRoadLesson = (lesson: { vehicle?: { licenseCategory?: string } | null } | null | undefined) =>
  isMotoLicenseCategory(lesson?.vehicle?.licenseCategory ?? null);
