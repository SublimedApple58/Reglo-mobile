/**
 * REG-696 Reglo Road — dove era l'auto qualche secondo fa.
 *
 * L'istruttore segnala un errore 5–20 s dopo averlo visto (apre «Segnala»,
 * cerca la voce): a 40 km/h vuol dire 50–150 m dopo l'incrocio. Qui restano
 * gli ultimi due minuti di posizioni (ascolto a 1 Hz + punti del tracking)
 * per rimettere la segnalazione dove è successo.
 */

type Fix = { t: number; lat: number; lng: number };

const KEEP_MS = 120_000;
const MAX = 400;
let fixes: Fix[] = [];

export const fixHistory = {
  push(lat: number, lng: number, t = Date.now()) {
    const last = fixes[fixes.length - 1];
    if (last && t <= last.t) return;
    fixes.push({ t, lat, lng });
    if (fixes.length > MAX || (fixes.length && t - fixes[0].t > KEEP_MS)) {
      fixes = fixes.filter((f) => t - f.t <= KEEP_MS).slice(-MAX);
    }
  },

  /** Posizione all'istante `at` (la più vicina prima), o null se non coperto. */
  at(at: number): { lat: number; lng: number; t: number } | null {
    if (!fixes.length || at < fixes[0].t - 5_000) return null;
    for (let i = fixes.length - 1; i >= 0; i--) {
      if (fixes[i].t <= at) return fixes[i];
    }
    return fixes[0];
  },

  clear() {
    fixes = [];
  },
};
