import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/**
 * REG-786 — seed del foglio «guida fatta» (`guide/lesson`): la tab Guide
 * pubblica la guida e la modalità di pagamento dell'autoscuola, il foglio
 * dipinge subito senza chiedere niente (il percorso Road arriva dalla cache).
 */
export type DoneLessonData = {
  lesson: AutoscuolaAppointmentWithRelations;
  /** L'autoscuola incassa a mano (`isCompanyManualMode`). */
  manualMode: boolean;
  /** Road acceso e percorsi condivisi con l'allievo: vale la pena chiedere la traccia. */
  roadVisible: boolean;
};

let _data: DoneLessonData | null = null;
const _listeners = new Set<() => void>();

export const doneLessonStore = {
  set(data: DoneLessonData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): DoneLessonData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
