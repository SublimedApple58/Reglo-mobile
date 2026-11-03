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
