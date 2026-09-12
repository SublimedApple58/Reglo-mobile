/**
 * Seed del form sheet "voce del pagellino" (Altro → Pagellino → tocca una voce
 * / Aggiungi voce). Stesso pattern seed-and-callback degli altri sheet nativi:
 * la schermata tiene il draft, il foglio disegna e restituisce i valori.
 */
export type EvaluationItemValues = {
  label: string;
  scaleMax: number;
};

export type EvaluationItemFormData = {
  /** null = voce nuova. */
  initial: EvaluationItemValues | null;
  onSubmit: (values: EvaluationItemValues) => void;
  /** Assente sulla voce nuova: non c'è ancora niente da eliminare. */
  onDelete?: () => void;
};

let _data: EvaluationItemFormData | null = null;
const _listeners = new Set<() => void>();

export const evaluationItemStore = {
  set(data: EvaluationItemFormData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): EvaluationItemFormData | null {
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
