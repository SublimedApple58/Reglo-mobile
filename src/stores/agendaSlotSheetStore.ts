/**
 * Drives the `home/agenda-slot` form sheet — la cella «+N» della griglia
 * settimanale quando nella stessa fascia ci sono più impegni di quanti ne
 * stiano affiancati. La griglia semina le righe (già in memoria) e `onPick`;
 * il foglio si chiude e poi apre l'impegno toccato.
 */
export type AgendaSlotRow = {
  key: string;
  instructorName: string;
  instructorUserId?: string | null;
  /** «Rossi Mario · 10:00 – 11:00». */
  detail: string;
};

export type AgendaSlotSheetData = {
  /** «Martedì 11 novembre». */
  title: string;
  /** «10:00 – 12:00 · 5 impegni». */
  subtitle: string;
  rows: AgendaSlotRow[];
  onPick: (key: string) => void;
};

let _data: AgendaSlotSheetData | null = null;
const _listeners = new Set<() => void>();

export const agendaSlotSheetStore = {
  set(data: AgendaSlotSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): AgendaSlotSheetData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
