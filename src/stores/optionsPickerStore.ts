/**
 * Drives the `home/select-options` form sheet — a small reusable single/multi
 * select used by the "Nuova prenotazione" form for Durata, Veicolo and Tipo.
 * The opener publishes the title, the options, the current selection and an
 * onConfirm callback, then pushes the route. Single-select applies on tap and
 * pops; multi-select toggles locally and applies on the confirm CTA.
 */
export type OptionItem = {
  value: string;
  label: string;
  subtitle?: string | null;
  /** When set, the row shows a neutral leading avatar with these initials
   *  (used by the "Aggiungi allievo" picker to read as a student list). */
  leadingInitials?: string | null;
};

export type OptionsPickerData = {
  title: string;
  options: OptionItem[];
  selected: string[];
  multi: boolean;
  onConfirm: (values: string[]) => void;
};

let _data: OptionsPickerData | null = null;
const _listeners = new Set<() => void>();

export const optionsPickerStore = {
  set(data: OptionsPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): OptionsPickerData | null {
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
