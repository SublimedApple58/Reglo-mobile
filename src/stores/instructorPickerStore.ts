import type { AutoscuolaInstructor } from '../types/regloApi';

/**
 * Drives the `home/manage-lesson-instructor` formSheet route. The manage-lesson
 * route publishes the current instructor id + the selected (staged) id + an
 * onSelect callback, then pushes the route. The picker reads this, renders the
 * list, and calls onSelect on tap.
 */
export type InstructorPickerData = {
  currentInstructorId: string | null;
  selectedInstructorId: string | null;
  onSelect: (instructor: AutoscuolaInstructor) => void;
};

let _data: InstructorPickerData | null = null;
const _listeners = new Set<() => void>();

export const instructorPickerStore = {
  set(data: InstructorPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): InstructorPickerData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
