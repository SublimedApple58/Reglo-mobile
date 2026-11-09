/**
 * REG-640 — guida il form sheet `home/exam-examiners`: gli esaminatori esterni
 * di un esame (nomi liberi, di solito uno). Chi apre (Crea esame o la scheda
 * dell'esame) pubblica i nomi attuali + `onConfirm`, poi spinge la rotta.
 * `onConfirm` può essere asincrono: il foglio mostra lo spinner sulla CTA e si
 * chiude solo a risposta arrivata (niente optimistic update).
 */
export type ExaminersSheetData = {
  examiners: string[];
  /** «Fatto» in creazione (si salva col resto), «Salva» sull'esame esistente. */
  ctaTitle: string;
  onConfirm: (names: string[]) => void | Promise<void>;
};

let _data: ExaminersSheetData | null = null;
const _listeners = new Set<() => void>();

export const examinersSheetStore = {
  set(data: ExaminersSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ExaminersSheetData | null {
    return _data;
  },
  clear() {
    _data = null;
    _listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};

/** Spazi ripuliti, righe vuote e doppioni via — come `normalizeExaminers` sul BE. */
export const cleanExaminers = (names: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase('it');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, EXAMINERS_MAX);
};

export const EXAMINERS_MAX = 5;
