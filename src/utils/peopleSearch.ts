/**
 * Ricerca di persone in una lista: nome e cognome, senza accenti ne' maiuscole.
 *
 * Specchio di `lib/autoscuole/people-search.ts` nel repo web (REG-617): la
 * stessa ricerca deve comportarsi allo stesso modo da telefono e da scrivania,
 * altrimenti "non lo trovo nell'app" diventa una segnalazione.
 *
 * Due scelte dietro il comportamento:
 *
 * 1. **Senza accenti**: sulla tastiera di un telefono l'accento e' un ostacolo,
 *    e chi cerca scrive "Nicolo".
 * 2. **A parole, non a sottostringa**: "rossi mario" trova "Mario Rossi". Chi
 *    cerca non sa in che ordine la lista tiene nome e cognome.
 */

/** Minuscolo e senza segni diacritici: la forma in cui si confronta. */
export const foldForSearch = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Vero se ogni parola della ricerca compare in `haystack`, in qualunque
 * ordine. Una ricerca vuota (o di soli spazi) non filtra niente.
 */
export const matchesPersonSearch = (haystack: string, query: string): boolean => {
  const needles = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (!needles.length) return true;
  const hay = foldForSearch(haystack);
  return needles.every((needle) => hay.includes(needle));
};
