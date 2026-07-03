import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-instructor memory of the vehicles picked in the LAST booking flow (which
 * is not the same as the vehicles of the last lesson — student self-bookings
 * auto-assign and don't count), split by kind:
 *
 * - `car`  — last non-moto primary vehicle.
 * - `moto` — last moto primary vehicle, WITH its follow car (`'__none__'`
 *   sentinel included) and extra motos.
 *
 * The two slots are independent: a car booking never touches the moto memory
 * and vice versa. `BookingForm` picks the slot from the selected student's
 * pursued license (moto path → `moto`, otherwise `car`) and must still
 * validate every remembered id against the currently available vehicles.
 */
export type LastMotoSelection = {
  vehicleId: string;
  followVehicleId?: string;
  extraMotoVehicleIds?: string[];
};

export type LastBookingSelection = {
  car?: { vehicleId: string };
  moto?: LastMotoSelection;
};

const keyFor = (instructorId: string) => `lastBookingSelection:${instructorId}`;

export async function loadLastBookingSelection(
  instructorId: string,
): Promise<LastBookingSelection | null> {
  if (!instructorId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(instructorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastBookingSelection;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      car: typeof parsed.car?.vehicleId === 'string' ? { vehicleId: parsed.car.vehicleId } : undefined,
      moto: typeof parsed.moto?.vehicleId === 'string' ? parsed.moto : undefined,
    };
  } catch {
    return null;
  }
}

/** Fire-and-forget merge-save of one slot after a successful booking. */
export function saveLastBookingSelection(
  instructorId: string,
  slot: { car: { vehicleId: string } } | { moto: LastMotoSelection },
): void {
  if (!instructorId) return;
  void (async () => {
    try {
      const prev = (await loadLastBookingSelection(instructorId)) ?? {};
      const next: LastBookingSelection = { ...prev, ...slot };
      await AsyncStorage.setItem(keyFor(instructorId), JSON.stringify(next));
    } catch {
      // best-effort: losing the preference is harmless
    }
  })();
}
