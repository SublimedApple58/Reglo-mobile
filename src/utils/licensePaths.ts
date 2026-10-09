import type { LicensePath } from '../types/regloApi';

/**
 * REG-458 — a quale percorso patente appartiene una guida.
 *
 * Le guide **non** hanno una colonna `licensePathId`, ed è deliberato: ci sono
 * tredici punti nel prodotto che creano appuntamenti, e una colonna da
 * allineare su tutti e tredici si disallinea in silenzio appena ne sfugge uno.
 * Il percorso si ricava dalla data.
 *
 * Questo file è il gemello di `lib/autoscuole/license-paths.ts` nel repo web,
 * dove la stessa regola è coperta dai test. **Se cambia una delle due, cambiano
 * entrambe**: un allievo che vede sull'app un insieme di guide diverso da
 * quello che la segreteria vede sul gestionale è peggio del bug che questo
 * codice risolve.
 */

const ms = (value: string | null | undefined) =>
  value ? new Date(value).getTime() : 0;

const isOpen = (path: LicensePath) => (path.status ?? 'active') === 'active';

/** L'ultimo percorso iniziato non dopo quella data. */
export function pathForDate(paths: LicensePath[], date: string): LicensePath | null {
  if (paths.length === 0) return null;
  const when = new Date(date).getTime();
  if (Number.isNaN(when)) return null;
  const oldestFirst = [...paths].sort((a, b) => ms(a.startedAt) - ms(b.startedAt));
  let found: LicensePath | null = null;
  for (const path of oldestFirst) {
    if (ms(path.startedAt) <= when) found = path;
    else break;
  }
  // Una guida più vecchia di ogni percorso cade sul più vecchio: nessuna data
  // resta senza risposta, e il buco fra due percorsi non scopre nessuno.
  return found ?? oldestFirst[0] ?? null;
}

/**
 * Il percorso «corrente»: quello in corso, oppure — se l'allievo è patentato e
 * non ha ancora ripreso — l'ultimo chiuso.
 */
export function currentPath(paths: LicensePath[]): LicensePath | null {
  const open = paths.find(isOpen);
  if (open) return open;
  const closedNewestFirst = paths
    .filter((path) => !isOpen(path))
    .sort((a, b) => ms(b.closedAt) - ms(a.closedAt));
  return closedNewestFirst[0] ?? null;
}

/** «voglio vedere tutte le guide, di tutti i percorsi» */
export const ALL_LESSON_PATHS = 'all';

/**
 * Su quale percorso va ristretta la lista guide, data la scelta dell'allievo
 * (`null` = non ha scelto, vale il default).
 *
 * Con **meno di due percorsi non si filtra**, e quindi non si vede niente:
 * è il caso di quasi tutti gli allievi, e «solo le guide della B» sarebbe una
 * precisazione inutile quando la B è l'unica patente che esiste.
 */
export function lessonsPathFilterId(
  paths: LicensePath[],
  choice: string | null,
): string | null {
  if (paths.length < 2) return null;
  if (choice === ALL_LESSON_PATHS) return null;
  if (choice && paths.some((path) => path.id === choice)) return choice;
  return currentPath(paths)?.id ?? null;
}

/**
 * CQC e ADR sono **qualificazioni**, non patenti: non hanno un cambio, e
 * scrivere «CQC · Manuale» non vuol dire niente. Gemello di `isQualification`
 * nel repo web.
 */
const QUALIFICATIONS = ['CQC', 'ADR'];
export const isQualification = (category: string | null | undefined): boolean =>
  !!category && QUALIFICATIONS.some((q) => category.toUpperCase().startsWith(q));

/** Come si chiama un percorso a schermo: "B", "A2", "CQC". */
export const pathLabel = (path: LicensePath | null): string =>
  path?.licenseCategory ?? 'attuale';
