// On-device cache for the instructor Availability section, so the UI paints
// instantly from the last known state and refreshes in the background.
// Best-effort: every call is wrapped — a cache miss/error just falls through.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvailabilityMode, TimeRange } from '../types/regloApi';

export type CachedDay = { date: string; available: boolean; ranges: TimeRange[] };
export type CachedMode = { mode: AvailabilityMode; weeks: number };

const read = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = async (key: string, value: unknown): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* silent — cache is best-effort */
  }
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

  // Default-mode base weekly schedule
  getBase: (id: string) => read<{ daysOfWeek: number[]; ranges: TimeRange[] }>(`avail:base:${id}`),
  setBase: (id: string, v: { daysOfWeek: number[]; ranges: TimeRange[] }) => write(`avail:base:${id}`, v),
};
