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

export const normalizeLessonType = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const resolveInitialLessonType = (value: string | null | undefined) => {
  const normalized = normalizeLessonType(value);
  const match = LESSON_TYPE_OPTIONS.find((option) => option.value === normalized);
  return match?.value ?? '';
};

export const resolveInitialLessonTypes = (
  lesson: Pick<AutoscuolaAppointment, 'type' | 'types'>,
): string[] => {
  if (lesson.types && lesson.types.length > 0) {
    return lesson.types.map((t) => normalizeLessonType(t)).filter(Boolean);
  }
  const single = resolveInitialLessonType(lesson.type);
  return single ? [single] : [];
};
