import type { GroupLesson } from '../types/regloApi';

/**
 * Drives the `home/manage-group-lesson-participants` roster form sheet, opened
 * by the "Partecipanti" 3D CTA on the `manage-group-lesson` page sheet.
 *
 * The main modal seeds the currently-loaded `GroupLesson` detail and an
 * `onChanged` callback (re-loads the detail + refreshes the agenda). The roster
 * sheet renders participants (remove), an "Aggiungi allievo" row (eligible
 * picker → add) and an "Invita allievi idonei" button.
 */
export type GroupLessonParticipantsData = {
  groupLessonId: string;
  lesson: GroupLesson;
  /** Re-load the detail in the parent modal + refresh the agenda. */
  onChanged: () => void;
};

let _data: GroupLessonParticipantsData | null = null;
const _listeners = new Set<() => void>();

export const groupLessonParticipantsStore = {
  set(data: GroupLessonParticipantsData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): GroupLessonParticipantsData | null {
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
