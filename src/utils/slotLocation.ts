import type { AvailableSlot } from '../types/regloApi';

/**
 * REG-705e: `locationId` da mandare a `createBookingRequest` per lo slot scelto.
 * Lo slot lo porta solo con «Disponibilità per luogo» accesa; spenta, la
 * richiesta resta identica a prima (campo assente).
 */
export const slotLocationParam = (slot: Pick<AvailableSlot, 'locationId'>) =>
  slot.locationId !== undefined ? { locationId: slot.locationId } : {};

/** Identità di uno slot: alla stessa ora ce ne può essere uno per luogo. */
export const slotKey = (slot: Pick<AvailableSlot, 'startsAt' | 'locationId'>) =>
  `${slot.startsAt}|${slot.locationId ?? ''}`;

export const isSameSlot = (
  a: Pick<AvailableSlot, 'startsAt' | 'locationId'> | null | undefined,
  b: Pick<AvailableSlot, 'startsAt' | 'locationId'>,
) => !!a && slotKey(a) === slotKey(b);

/**
 * REG-705e: come mostrare il luogo in una lista di slot.
 * - `none`: nessuno slot ha un luogo (funzione spenta) → lista come prima;
 * - `single`: tutti allo stesso luogo → il nome va una volta sola, sotto il titolo;
 * - `multi`: luoghi diversi → il nome va su ogni slot e nel bottone.
 */
export type SlotLocationMode =
  | { mode: 'none' }
  | { mode: 'single'; name: string }
  | { mode: 'multi' };

export const slotLocationMode = (
  slots: ReadonlyArray<Pick<AvailableSlot, 'locationName'>>,
): SlotLocationMode => {
  const names = new Set(slots.map((s) => s.locationName ?? null));
  if (![...names].some(Boolean)) return { mode: 'none' };
  if (names.size === 1) return { mode: 'single', name: [...names][0] as string };
  return { mode: 'multi' };
};

export const firstName = (fullName: string | null | undefined) =>
  (fullName ?? '').trim().split(/\s+/)[0] ?? '';
