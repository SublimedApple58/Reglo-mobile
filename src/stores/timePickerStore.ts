type TimePickerData = {
  selectedTime: Date;
  onConfirm: (date: Date) => void;
};

let _data: TimePickerData | null = null;
const _listeners = new Set<() => void>();

export const timePickerStore = {
  set(data: TimePickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): TimePickerData | null {
    return _data;
  },
  clear() {
    _data = null;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
