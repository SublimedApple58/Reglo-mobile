import { useEffect, useSyncExternalStore } from 'react';
import { regloApi } from './regloApi';

/**
 * Cache client delle foto profilo per gli avatar (allievi/istruttori).
 * Le richieste dei singoli avatar vengono accumulate e risolte in un'unica
 * chiamata batched (GET /api/autoscuole/user-photos) ogni ~60ms.
 */

type Key = `u:${string}` | `i:${string}`;

const cache = new Map<Key, string | null>();
const queued = new Set<Key>();
const inflight = new Set<Key>();
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const notify = () => listeners.forEach((fn) => fn());

async function flush() {
  flushTimer = null;
  const batch = [...queued];
  queued.clear();
  batch.forEach((key) => inflight.add(key));

  const userIds = batch.filter((k) => k.startsWith('u:')).map((k) => k.slice(2));
  const instructorIds = batch.filter((k) => k.startsWith('i:')).map((k) => k.slice(2));

  try {
    const res = await regloApi.getUserPhotos(userIds, instructorIds);
    batch.forEach((key) => {
      const id = key.slice(2);
      cache.set(key, (key.startsWith('u:') ? res.users[id] : res.instructors[id]) ?? null);
    });
  } catch {
    batch.forEach((key) => cache.set(key, null));
  } finally {
    batch.forEach((key) => inflight.delete(key));
    notify();
  }
}

function requestKey(key: Key) {
  if (cache.has(key) || inflight.has(key) || queued.has(key)) return;
  queued.add(key);
  if (!flushTimer) flushTimer = setTimeout(() => void flush(), 60);
}

/** Invalida la foto di un utente (es. dopo un upload). */
export function invalidateUserPhoto(userId: string) {
  cache.delete(`u:${userId}` as Key);
  notify();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

function usePhotoByKey(key: Key | null) {
  const url = useSyncExternalStore(subscribe, () =>
    key ? (cache.get(key) ?? null) : null,
  );
  useEffect(() => {
    if (key) requestKey(key);
  }, [key]);
  return url;
}

/** URL foto profilo per uno userId/studentId (null finché non risolta o assente). */
export const useUserPhotoUrl = (userId?: string | null) =>
  usePhotoByKey(userId ? (`u:${userId}` as Key) : null);

/** URL foto profilo per un AutoscuolaInstructor.id. */
export const useInstructorPhotoUrl = (instructorId?: string | null) =>
  usePhotoByKey(instructorId ? (`i:${instructorId}` as Key) : null);
