import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../../types/regloApi';
import type { AgendaCreateKind, AgendaCreateSlot } from '../agenda/ghost';

/**
 * Giorno della scuola (REG-794): l'agenda «Tutti» del titolare e del
 * titolare-istruttore. Il contratto è comune a tutte le viste possibili
 * (A colonne-istruttore, B timeline, C elenco): la schermata passa i dati del
 * giorno e i gestori di tocco, la vista decide solo come disegnarli. Cambiare
 * vista = cambiare l'export in `./index.ts`.
 */

export type AvailWindow = { startMinutes: number; endMinutes: number };

/** Un istruttore della scuola, già nell'ordine delle colonne. */
export type SchoolInstructor = {
  id: string;
  name: string;
  userId: string | null;
  /** Il titolare-istruttore stesso («Tu», prima colonna). */
  isMe: boolean;
};

/** Disponibilità di tutti: id istruttore → giorno (YYYY-MM-DD) → fasce. */
export type SchoolAvailability = Record<string, Record<string, AvailWindow[]>>;

export type SchoolDayViewProps = {
  /** Il giorno mostrato. */
  date: Date;
  instructors: SchoolInstructor[];
  /** Impegni già caricati (anche di altri giorni: la vista filtra il suo). */
  appointments: AutoscuolaAppointmentWithRelations[];
  instructorBlocks: InstructorBlock[];
  availability: SchoolAvailability;
  holidays: Set<string>;
  loading: boolean;
  refreshing: boolean;
  onRefresh?: () => void;
  onPressAppointment: (appointment: AutoscuolaAppointmentWithRelations) => void;
  onPressExam: (appointments: AutoscuolaAppointmentWithRelations[]) => void;
  onPressGroupLesson: (groupLessonId: string) => void;
  /** Assente = blocchi non tappabili (titolare puro). */
  onPressBlock?: (block: InstructorBlock) => void;
  /** Tocco sul nome di un istruttore: la sua settimana. */
  onPressInstructor: (instructorId: string) => void;
  /** Creazione dal fantasma: la colonna dice per quale istruttore. */
  onCreateAt?: (kind: AgendaCreateKind, slot: AgendaCreateSlot) => void;
  createKinds: AgendaCreateKind[];
  carColor?: string | null;
  ghostResetKey: number;
  allowedDurations?: number[];
  onGhostActiveChange?: (active: boolean) => void;
};
