import type { AgendaSwatch } from '../utils/agendaColors';

/**
 * Drives the `more/color-picker` formSheet route (pannello "Aspetto agenda").
 * Lo screen impostazioni pubblica la voce da personalizzare (titolo, hex
 * corrente, palette) + un onSelect, poi push della route. Il picker legge
 * questo, mostra gli swatch e chiama onSelect al tap. `onSelect(null)` =
 * "Colore standard" (rimuove l'override).
 */
export type ColorPickerData = {
  title: string;
  subtitle?: string;
  /** Override corrente (null = colore standard/default). */
  currentHex: string | null;
  swatches: AgendaSwatch[];
  onSelect: (hex: string | null) => void;
};

let _data: ColorPickerData | null = null;
const _listeners = new Set<() => void>();

export const colorPickerStore = {
  set(data: ColorPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ColorPickerData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
