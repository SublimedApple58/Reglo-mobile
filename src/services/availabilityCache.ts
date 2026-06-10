// On-device cache for the instructor Availability section, so the UI paints
// instantly from the last known state and refreshes in the background.
// Best-effort: every call is wrapped — a cache miss/error just falls through.

import { AvailabilityMode, TimeRange } from '../types/regloApi';

export type CachedDay = { date: string; available: boolean; ranges: TimeRange[] };
export type CachedMode = { mode: AvailabilityMode; weeks: number };
// Default-mode base: per-weekday ranges (0=Sun..6=Sat). Empty/absent day = off.
export type CachedBase = { scheduleByDay: Record<number, TimeRange[]> };

// OTA-safe: the production binary (build 31/03) doesn't bundle async-storage's
// native module, so this best-effort cache degrades to in-memory until the next
// native build. It still caches within a session; it just doesn't survive a
// cold start (→ a single refetch). Restore async-storage with the native build.
const mem = new Map<string, unknown>();

const read = async <T>(key: string): Promise<T | null> => {
  const v = mem.get(key);
  return v === undefined ? null : (v as T);
};

const write = async (key: string, value: unknown): Promise<void> => {
  mem.set(key, value);
};

export const availabilityCache = {
  // Active mode + horizon weeks (read by the shell to skip the initial wait)
  getMode: (id: string) => read<CachedMode>(`avail:mode:${id}`),
  setMode: (id: string, v: CachedMode) => write(`avail:mode:${id}`, v),

  // Published weeks horizon (rail dots)
  getPublishedWeeks: (id: string) => read<string[]>(`avail:pubweeks:${id}`),
  setPublishedWeeks: (id: string, weeks: string[]) => write(`avail:pubweeks:${id}`, weeks),

  // Per-week day states (publication mode)
  getWeekDays: (id: string, weekStart: string) => read<CachedDay[]>(`avail:week:${id}:${weekStart}`),
  setWeekDays: (id: string, weekStart: string, days: CachedDay[]) => write(`avail:week:${id}:${weekStart}`, days),

  // Default-mode base weekly schedule (per-weekday ranges)
  getBase: (id: string) => read<CachedBase>(`avail:base:${id}`),
  setBase: (id: string, v: CachedBase) => write(`avail:base:${id}`, v),
};
