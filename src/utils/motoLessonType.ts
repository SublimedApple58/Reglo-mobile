// Tipo strutturato di una guida MOTO: "birilli" (prova in area chiusa, slalom
// tra i coni) vs "strada" (guida su strada). Sola lettura su mobile in v1 — il
// valore arriva dal backend (AutoscuolaAppointment.motoLessonType). Mirror del
// modulo web lib/autoscuole/moto-lesson-type.ts.
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export const MOTO_LESSON_TYPES = ['birilli', 'strada'] as const;

export type MotoLessonType = (typeof MOTO_LESSON_TYPES)[number];

export const MOTO_LESSON_TYPE_LABELS: Record<MotoLessonType, string> = {
  birilli: 'Birilli',
  strada: 'Strada',
};

export const MOTO_LESSON_TYPE_HINTS: Record<MotoLessonType, string> = {
  birilli: 'Area chiusa · coni',
  strada: 'Guida su strada',
};

export const MOTO_LESSON_TYPE_ICON: Record<
  MotoLessonType,
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  birilli: 'traffic-cone',
  strada: 'road-variant',
};

export function asMotoLessonType(value: unknown): MotoLessonType | null {
  return value === 'birilli' || value === 'strada' ? value : null;
}

export function motoLessonTypeLabel(value: unknown): string | null {
  const t = asMotoLessonType(value);
  return t ? MOTO_LESSON_TYPE_LABELS[t] : null;
}
