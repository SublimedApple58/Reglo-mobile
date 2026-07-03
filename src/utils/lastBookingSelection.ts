import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-instructor memory of the vehicle picked in the LAST booking flow (which
 * is not the same as the vehicle of the last lesson — student self-bookings
 * auto-assign and don't count). Used to preselect Veicolo (and Auto al seguito
 * for moto bookings) when the booking sheet opens; the caller must still check
 * the remembered ids against the currently available vehicles.
 *
 * `followVehicleId` may be the '__none__' sentinel (explicit "Nessuna auto al
 * seguito") and is only overwritten by moto bookings, so a car booking doesn't
 * wipe the remembered follow car.
 */
export type LastBookingSelection = {
  vehicleId: string;
  followVehicleId?: string;
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
    if (!parsed || typeof parsed.vehicleId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget save after a successful booking. `followVehicleId`
 * undefined = keep the previously stored one (non-moto booking).
 */
export function saveLastBookingSelection(
  instructorId: string,
  selection: { vehicleId: string; followVehicleId?: string },
): void {
  if (!instructorId || !selection.vehicleId) return;
  void (async () => {
    try {
      const prev = await loadLastBookingSelection(instructorId);
      const next: LastBookingSelection = {
        vehicleId: selection.vehicleId,
        followVehicleId: selection.followVehicleId ?? prev?.followVehicleId,
      };
      await AsyncStorage.setItem(keyFor(instructorId), JSON.stringify(next));
    } catch {
      // best-effort: losing the preference is harmless
    }
  })();
}
