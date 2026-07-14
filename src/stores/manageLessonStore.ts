import type {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaInstructor,
  AutoscuolaLocation,
} from '../types/regloApi';

/**
 * Vehicle option for the "Veicolo" picker: display name + an elegant subtitle
 * (license category and, where assigned, the instructor it belongs to).
 */
export type ManageLessonVehicle = {
  id: string;
  name: string;
  subtitle?: string | null;
  /** License taxonomy — drives moto/car split + student eligibility in pickers. */
  licenseCategory?: string | null;
  transmission?: string | null;
  /** Pool/exclusivity — filters pickers to vehicles the instructor can use. */
  assignedInstructorId?: string | null;
  poolInstructorIds?: string[] | null;
};

export type ManageLessonStateMeta = {
  label: string;
  tone: 'live' | 'confirmed' | 'scheduled' | 'pending_review';
};

export type ManageLessonMenuOption = {
  key: string;
  label: string;
  danger?: boolean;
};

/** Payload saved from the details sub-sheet (tipo guida / valutazione / note). */
export type ManageLessonDetailsPayload = {
  lessonTypes: string[];
  rating: number | null;
  notes: string;
};

/**
 * Drives the `home/manage-lesson` modal route (instructor "Gestisci guida") and
 * its `home/manage-lesson-details` sub-sheet. The parent screen
 * (IstruttoreHomeScreen) keeps all API/refresh logic and publishes the current
 * lesson + computed flags + callbacks here; the routes render from this snapshot.
 *
 * Save model: instructor and location persist on selection (auto-save); tipo
 * guida / valutazione / note are saved from the details sub-sheet. There is no
 * global "Salva" on the main sheet.
 */
export type ManageLessonData = {
  lesson: AutoscuolaAppointmentWithRelations;
  studentProgress: { completed: number; required: number } | null;
  stateMeta: ManageLessonStateMeta | null;
  stateLabel: string;
  durationText: string;
  vehiclesEnabled: boolean;
  vehicleText: string;
  /** Company vehicles available to assign (for the "Veicolo" picker). */
  vehicles: ManageLessonVehicle[];
  /** The pursued license of the lesson's student — filters eligible motos. */
  studentLicense?: { licenseCategory?: string | null; transmission?: string | null } | null;
  /** Global follow-car rule map (all-moto on/off) — gates the "obbligatoria" tag. */
  followCarRules?: Record<string, { enabled?: boolean } | undefined>;
  defaultLocation: AutoscuolaLocation | null;
  isDetailsEditable: boolean;
  /** Owner/titolare view-only: static rows, no edit CTA, no bottom actions. */
  readOnly?: boolean;
  /** Show the Presente/Assente status row. */
  showStatusActions: boolean;
  /**
   * Correction mode: the live action window has closed (guida passata) but the
   * outcome is still correctable. Drives the "Correggi guida" framing — overline,
   * correction band, "attuale" marker on the current outcome.
   */
  correctionMode: boolean;
  /** Whether the "Presente" (check-in) button should appear. */
  allowPresente: boolean;
  /** Show the star-rating section (in the details sub-sheet). */
  showRating: boolean;
  pendingAction: string | null;
  /** Quick actions surfaced as pills under the ring (sposta / scambia / cancella). */
  menuOptions: ManageLessonMenuOption[];
  // callbacks (owned by the parent screen)
  /** Save tipo/voto/note from the details sub-sheet. Returns true on success. */
  onSaveDetails: (payload: ManageLessonDetailsPayload) => Promise<boolean>;
  /** Reassign instructor — checks availability and auto-saves (optimistic). */
  onChangeInstructor: (instructor: AutoscuolaInstructor) => void;
  onStatus: (action: 'checked_in' | 'no_show') => void;
  onMenu: (key: string) => void;
  onChangeLocation: (location: AutoscuolaLocation) => void;
  /** Reassign the lesson's primary vehicle (null = unassign) — auto-saves. */
  onChangeVehicle: (vehicleId: string | null) => void;
  /** Replace the extra motos (role="primary" rows beyond the main one) — auto-saves. */
  onChangeExtraMotos: (vehicleIds: string[]) => void;
  /** Set/replace/remove the follow car (null = remove) — auto-saves. */
  onChangeFollowVehicle: (vehicleId: string | null) => void;
  /** Called when the main route is dismissed (popped), so the parent can reset. */
  onClosed: () => void;
};

let _data: ManageLessonData | null = null;
const _listeners = new Set<() => void>();

export const manageLessonStore = {
  set(data: ManageLessonData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): ManageLessonData | null {
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
