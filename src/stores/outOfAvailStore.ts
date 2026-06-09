/**
 * Drives the `home/out-of-availability` modal route — the instructor's "Guide
 * fuori disponibilità" list. The parent (IstruttoreHomeScreen) seeds the current
 * appointments + an onChanged callback; the route runs the cancel/keep actions
 * via regloApi, removes rows locally, and calls onChanged so the home refreshes
 * the banner + agenda. Seed-and-callback, like the other home sheets.
 */
import type { OutOfAvailabilityAppointment } from '../types/regloApi';

export type OutOfAvailData = {
  appointments: OutOfAvailabilityAppointment[];
  /** Called after each action so the home reloads the banner count + agenda. */
  onChanged: () => void;
};

let _data: OutOfAvailData | null = null;
const _listeners = new Set<() => void>();

export const outOfAvailStore = {
  set(data: OutOfAvailData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): OutOfAvailData | null {
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
