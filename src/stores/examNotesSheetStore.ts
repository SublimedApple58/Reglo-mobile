/**
 * REG-640 — guida il form sheet `home/exam-notes`: le note generali di un
 * esame già creato (prima, riaprendo l'esame, si potevano solo leggere).
 * `onConfirm` è asincrono: il foglio si chiude a risposta arrivata.
 */
export type ExamNotesSheetData = {
  notes: string;
  onConfirm: (notes: string | null) => Promise<void>;
};

let _data: ExamNotesSheetData | null = null;
const _listeners = new Set<() => void>();

export const examNotesSheetStore = {
  set(data: ExamNotesSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ExamNotesSheetData | null {
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
