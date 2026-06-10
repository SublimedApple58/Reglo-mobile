import type { MobileStudentPaymentProfile } from '../types/regloApi';

export type SlotTarget = 'morningStart' | 'morningEnd' | 'afternoonStart' | 'afternoonEnd';

export type SettingsStoreData = {
  // profile
  name: string;
  phone: string;
  saving: boolean;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  onSaveProfile: () => void;
  // availability
  hasProfile: boolean;
  weeks: number;
  availabilityDays: number[];
  toggleDay: (d: number) => void;
  morningActive: boolean;
  afternoonActive: boolean;
  toggleMorning: () => void;
  toggleAfternoon: () => void;
  morningStart: Date;
  morningEnd: Date;
  afternoonStart: Date;
  afternoonEnd: Date;
  onPickSlotTime: (target: SlotTarget, date: Date) => void;
  availabilitySaving: boolean;
  onSaveAvailability: () => void;
  // payment
  paymentProfile: MobileStudentPaymentProfile | null;
  paymentLoading: boolean;
  onConfigurePayment: () => void;
  onRemovePayment: () => void;
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
