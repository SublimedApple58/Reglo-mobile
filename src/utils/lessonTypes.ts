import type { AutoscuolaAppointment } from '../types/regloApi';

export type LessonTypeOption = { value: string; label: string };

export const LESSON_TYPE_OPTIONS: LessonTypeOption[] = [
  { value: 'manovre', label: 'Manovre' },
  { value: 'urbano', label: 'Urbano' },
  { value: 'extraurbano', label: 'Extraurbano' },
  { value: 'notturna', label: 'Notturna' },
  { value: 'autostrada', label: 'Autostrada' },
  { value: 'parcheggio', label: 'Parcheggio' },
  { value: 'altro', label: 'Altro' },
];

export const LESSON_TYPE_LABEL_MAP: Record<string, string> = {
  manovre: 'Manovre',
  urbano: 'Urbano',
  extraurbano: 'Extraurbano',
  notturna: 'Notturna',
  autostrada: 'Autostrada',
  parcheggio: 'Parcheggio',
  altro: 'Altro',
  guida: 'Guida',
  esame: 'Esame',
};

export const resolveAppointmentTypes = (
  appt: Pick<AutoscuolaAppointment, 'type' | 'types'>,
): string[] => {
  if (appt.types && appt.types.length > 0) return appt.types;
  return appt.type ? [appt.type] : [];
};

export const formatLessonType = (type: string): string =>
  LESSON_TYPE_LABEL_MAP[type.trim().toLowerCase()] ??
  type.charAt(0).toUpperCase() + type.slice(1);

export const formatMultipleTypes = (types: string[]): string =>
  types.map(formatLessonType).join(', ');
