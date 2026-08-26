import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import type { ManageLessonDetailsPayload } from './manageLessonStore';

/**
 * Drives the `manage-lesson-details` sub-sheet (registered in the home AND
 * notes stacks). Store DEDICATO: prima il foglio leggeva manageLessonStore e
 * il seed "minimale" dello storico allievo (StudentNotesDetailScreen)
 * SOVRASCRIVEVA lo snapshot completo mentre ManageLessonScreen era ancora
 * montata sotto → re-render con menuOptions undefined → crash (2026-08-05).
 * Con lo store separato i due fogli non possono più pestarsi i dati.
 */
export type LessonDetailsData = {
  lesson: AutoscuolaAppointmentWithRelations;
  /** Show the star-rating section. */
  showRating: boolean;
  /** Mostra il selettore Esito (solo storico allievo). */
  showEsito?: boolean;
  isDetailsEditable: boolean;
  /** Save tipo/voto/note (+esito). Returns true on success. */
  onSaveDetails: (payload: ManageLessonDetailsPayload) => Promise<boolean>;
};

let _data: LessonDetailsData | null = null;
const _listeners = new Set<() => void>();

export const lessonDetailsStore = {
  set(data: LessonDetailsData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): LessonDetailsData | null {
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
