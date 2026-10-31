/**
 * REG-699 Reglo Road — «rientro in tempo per la prossima?».
 *
 * - Con il giro: orario di rientro = adesso + distanza che manca sulla linea /
 *   velocità media della guida finora (tra 15 e 50 km/h; nel primo km 25 km/h,
 *   la media è ancora rumore). È una stima, come ogni ETA.
 * - Senza giro: niente rientro, solo i minuti alla fine della guida.
 * - L'ultima stima si manda col lotto di punti (`eta`): la vista «Dal vivo» del
 *   titolare mostra lo stesso orario.
 */

const MIN_MS = 15 / 3.6;
const MAX_MS = 50 / 3.6;
const START_MS = 25 / 3.6;
/** Avviso «mancano 5 minuti». */
export const END_WARN_MS = 5 * 60_000;

let lastEta: number | null = null;

export const roadEta = {
  /** Ultima stima (ms epoch) o null: la legge l'uploader. */
  get: () => lastEta,
  set(eta: number | null) {
    lastEta = eta;
  },
};

export function estimateReturn(opts: {
  now: number;
  leftMeters: number | null;
  doneMeters: number;
  startedAt: number;
}): number | null {
  if (opts.leftMeters == null) return null;
  const elapsed = (opts.now - opts.startedAt) / 1000;
  const avg = opts.doneMeters >= 1000 && elapsed > 0 ? opts.doneMeters / elapsed : START_MS;
  const v = Math.min(MAX_MS, Math.max(MIN_MS, avg));
  return opts.now + (opts.leftMeters / v) * 1000;
}

export type ReturnView =
  /** Con il giro: «10:52» e quanto prima/dopo la fine. */
  | { kind: 'eta'; eta: number; deltaMin: number }
  /** Senza giro: minuti alla fine (negativi = oltre). */
  | { kind: 'end'; minutesLeft: number };

export function returnView(opts: { now: number; endsAt: number | null; eta: number | null }): ReturnView | null {
  if (opts.eta != null && opts.endsAt != null) {
    return { kind: 'eta', eta: opts.eta, deltaMin: Math.round((opts.eta - opts.endsAt) / 60_000) };
  }
  if (opts.endsAt == null) return null;
  const left = opts.endsAt - opts.now;
  return { kind: 'end', minutesLeft: left >= 0 ? Math.ceil(left / 60_000) : -Math.ceil(-left / 60_000) };
}

/** Testo breve del ritardo/anticipo: «in orario», «3 min oltre», «5 min prima». */
export function deltaLabel(deltaMin: number): string {
  if (Math.abs(deltaMin) <= 1) return 'in orario';
  return deltaMin > 0 ? `${deltaMin} min oltre` : `${-deltaMin} min prima`;
}
