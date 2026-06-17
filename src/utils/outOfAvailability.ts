import type { OutOfAvailabilityAppointment } from '../types/regloApi';

export type OobGroup = {
  key: string;
  /** Representative appointment (first seat) — for the shared slot/instructor/vehicle. */
  rep: OutOfAvailabilityAppointment;
  /** All underlying appointment ids (one per participant for a group lesson). */
  ids: string[];
  /** Participant count (1 for a normal lesson). */
  count: number;
  isGroupLesson: boolean;
};

/**
 * Collapse group-lesson participant appointments into ONE entry: the participants
 * of a single group lesson share the exact same slot (startsAt/endsAt) + instructor
 * + vehicle, so they are one lesson, not N separate "guide fuori disponibilità".
 * Normal lessons stay 1:1. (The API shape has no groupLessonId, so we key on the
 * shared slot — an instructor can't run two group lessons at once on one vehicle.)
 */
export function groupOutOfAvailability(
  items: OutOfAvailabilityAppointment[],
): OobGroup[] {
  const map = new Map<string, OutOfAvailabilityAppointment[]>();
  for (const a of items) {
    const key =
      a.type === 'group_lesson'
        ? `gl|${a.startsAt}|${a.endsAt}|${a.instructorName ?? ''}|${a.vehicleName ?? ''}`
        : `single|${a.id}`;
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, list]) => ({
    key,
    rep: list[0],
    ids: list.map((a) => a.id),
    count: list.length,
    isGroupLesson: list[0].type === 'group_lesson',
  }));
}
