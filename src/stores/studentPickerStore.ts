/**
 * Drives the `home/select-student` modal route — the searchable student picker
 * used by the "Nuova prenotazione" form. The opener (new-booking) publishes the
 * staged selection + the available options + an onSelect callback, then pushes
 * the route. The picker reads this, renders a search + list, and calls onSelect
 * on tap. Mirrors `instructorPickerStore` / `timePickerStore`.
 */
export type StudentPickerOption = { value: string; label: string; subtitle: string | null };

export type StudentPickerData = {
  selectedId: string | null;
  options: StudentPickerOption[];
  onSelect: (value: string) => void;
};

let _data: StudentPickerData | null = null;
const _listeners = new Set<() => void>();

export const studentPickerStore = {
  set(data: StudentPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): StudentPickerData | null {
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
