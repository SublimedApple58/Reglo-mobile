/**
 * Drives the `home/select-exam-students` page-sheet route — the MULTI-select
 * student picker used by "Crea esame". The opener (CreateExamScreen) publishes the
 * staged selection + the available options + an onConfirm callback, then pushes the
 * route. The picker renders a search + checkbox list and calls onConfirm on apply.
 * Multi-select sibling of `studentPickerStore` (which is single-select).
 */
export type ExamStudentOption = {
  value: string;
  label: string;
  subtitle: string | null;
  isMyCluster: boolean;
  /** Categoria patente in preparazione (B, A2, …). Mostrata nella lista. */
  license?: string | null;
  /** Segnato "pronto per l'esame" (segnale interno). Badge + ordine in cima. */
  examReady?: boolean;
};

export type ExamStudentsData = {
  selectedIds: string[];
  options: ExamStudentOption[];
  onConfirm: (ids: string[]) => void;
};

let _data: ExamStudentsData | null = null;
const _listeners = new Set<() => void>();

export const examStudentsStore = {
  set(data: ExamStudentsData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ExamStudentsData | null {
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
