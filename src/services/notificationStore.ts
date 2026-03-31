import * as SecureStore from 'expo-secure-store';
import { NotificationItem, PersistedNotification } from '../types/notifications';

const STORE_KEY = 'reglo_notifications_inbox';
const LEGACY_READ_KEY = 'reglo_read_notification_ids';
const LEGACY_SEEN_KEY = 'reglo_seen_accepted_swap_ids';
const MAX_AGE_DAYS = 30;

const isExpired = (item: PersistedNotification): boolean => {
  const age = Date.now() - new Date(item.receivedAt).getTime();
  if (age > MAX_AGE_DAYS * 86_400_000) return true;
  // Check expiresAt on data if present (swap, waitlist)
  const expiresAt = item.data?.expiresAt;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return true;
  return false;
};

export const loadInbox = async (): Promise<PersistedNotification[]> => {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as PersistedNotification[];
    // Only filter expired — dismissed items stay so merge can see them
    return items.filter((i) => !isExpired(i));
  } catch {
    return [];
  }
};

export const saveInbox = async (items: PersistedNotification[]): Promise<void> => {
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(items));
  } catch {
    // silent
  }
};

export const mergeFromApi = (
  existing: PersistedNotification[],
  apiItems: NotificationItem[],
): PersistedNotification[] => {
  const map = new Map<string, PersistedNotification>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  const now = new Date().toISOString();
  for (const api of apiItems) {
    const prev = map.get(api.id);
    if (prev) {
      // Update data but keep read/dismissed/receivedAt
      map.set(api.id, { ...prev, data: api.data, kind: api.kind });
    } else {
      map.set(api.id, {
        kind: api.kind,
        id: api.id,
        data: api.data,
        receivedAt: now,
        read: false,
        dismissed: false,
      });
    }
  }
  return [...map.values()].filter((i) => !isExpired(i));
};

export const markRead = (
  items: PersistedNotification[],
  id: string,
): PersistedNotification[] =>
  items.map((i) => (i.id === id ? { ...i, read: true } : i));

export const markAllRead = (
  items: PersistedNotification[],
): PersistedNotification[] =>
  items.map((i) => (i.read ? i : { ...i, read: true }));

export const dismissItem = (
  items: PersistedNotification[],
  id: string,
): PersistedNotification[] =>
  items.map((i) => (i.id === id ? { ...i, dismissed: true } : i));

/**
 * One-time migration: read legacy keys, apply to inbox, then delete them.
 */
export const migrateLegacyKeys = async (
  inbox: PersistedNotification[],
): Promise<PersistedNotification[]> => {
  let updated = inbox;
  try {
    const readRaw = await SecureStore.getItemAsync(LEGACY_READ_KEY);
    if (readRaw) {
      const readIds = new Set(JSON.parse(readRaw) as string[]);
      updated = updated.map((i) =>
        readIds.has(i.id) ? { ...i, read: true } : i,
      );
      await SecureStore.deleteItemAsync(LEGACY_READ_KEY);
    }
  } catch {
    // silent
  }
  try {
    const seenRaw = await SecureStore.getItemAsync(LEGACY_SEEN_KEY);
    if (seenRaw) {
      await SecureStore.deleteItemAsync(LEGACY_SEEN_KEY);
    }
  } catch {
    // silent
  }
  return updated;
};
