export type AgendaViewMode = 'day' | 'week';
export type InstrAvailabilityMode = 'default' | 'publication';

// Published by SettingsScreen for instructor/owner so the dedicated formSheet
// sub-pages in the "Altro" stack (more/agenda-view, more/availability-mode,
// more/agenda-settings) can bind to the live state + handlers.
export type InstructorSettingsStoreData = {
  // Vista agenda (instructor/owner)
  agendaViewMode: AgendaViewMode;
  onPickAgendaView: (m: AgendaViewMode) => void;
  // Disponibilità mode (instructor)
  availabilityMode: InstrAvailabilityMode;
  onPickAvailabilityMode: (m: InstrAvailabilityMode) => void;
  // Agenda settings (owner)
  availabilityWeeks: string;
  setAvailabilityWeeks: (v: string) => void;
  studentReminderMinutes: string;
  setStudentReminderMinutes: (v: string) => void;
  instructorReminderMinutes: string;
  setInstructorReminderMinutes: (v: string) => void;
  savingSettings: boolean;
  onSaveOwnerSettings: () => void;
};

let _data: InstructorSettingsStoreData | null = null;
const _listeners = new Set<() => void>();

export const instructorSettingsStore = {
  set(data: InstructorSettingsStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): InstructorSettingsStoreData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
