import type { AutoscuolaAppointmentWithRelations, AutoscuolaSettings } from '../types/regloApi';

/**
 * Seed della schermata "Pagamenti" del dettaglio allievo (REG-450).
 *
 * Stesso pattern seed-and-callback degli altri fogli nativi: la scheda allievo
 * ha già in mano lo storico completo (comprese le annullate) e le impostazioni
 * dell'autoscuola, quindi la schermata apre con i dati già pronti — niente
 * spinner al primo frame. Dopo ogni scrittura andata a buon fine chiama
 * `onChanged` per far ricaricare la scheda sotto.
 */
export type StudentPaymentsSettings = Pick<
  AutoscuolaSettings,
  'autoPaymentsEnabled' | 'lessonCreditFlowEnabled' | 'lessonCreditsRequired'
>;

export type StudentPaymentsData = {
  studentName: string | null;
  /** Storico COMPLETO: le annullate servono per il filtro e per le penali tardive. */
  lessons: AutoscuolaAppointmentWithRelations[];
  settings: StudentPaymentsSettings | null;
  /** L'utente corrente è titolare → nessuna restrizione sulle guide altrui. */
  isOwner: boolean;
  /** `session.instructorId`, per la guardia "solo le tue guide". */
  myInstructorId: string | null;
  onChanged?: () => void | Promise<void>;
};

let _data: StudentPaymentsData | null = null;
const _listeners = new Set<() => void>();

export const studentPaymentsStore = {
  set(data: StudentPaymentsData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): StudentPaymentsData | null {
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
