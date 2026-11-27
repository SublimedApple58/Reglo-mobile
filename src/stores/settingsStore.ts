export type SettingsStoreData = {
  // profile
  name: string;
  phone: string;
  saving: boolean;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  onSaveProfile: () => void;
};

let _data: SettingsStoreData | null = null;
const _listeners = new Set<() => void>();

export const settingsStore = {
  set(data: SettingsStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): SettingsStoreData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
