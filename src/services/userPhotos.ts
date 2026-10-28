import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { regloApi } from './regloApi';
import { clearPhotoDiskCache } from './photoDiskCache';

/**
 * Cache client delle foto profilo per gli avatar (allievi/istruttori).
 * Le richieste dei singoli avatar vengono accumulate e risolte in un'unica
 * chiamata batched (GET /api/autoscuole/user-photos) ogni ~60ms.
 *
 * Giro Road (Tiziano 28/10): la mappa id → URL resta anche sul telefono
 * (AsyncStorage), così alla seconda apertura i volti sono subito lì; la
 * chiamata la riconferma in background (stale-while-revalidate). Gli URL
 * firmati (R2 senza base pubblica, validi 1 h) si riusano solo se recenti.
 */

type Key = `u:${string}` | `i:${string}`;
type Entry = { u: string | null; t: number };

const STORAGE_KEY = 'reglo.userPhotos.v1';
const SIGNED_MAX_AGE_MS = 45 * 60 * 1000;
const MAX_ENTRIES = 400;

const cache = new Map<Key, Entry>();
/** Chiavi già riconfermate dal server in questa sessione. */
const fresh = new Set<Key>();
const queued = new Set<Key>();
const inflight = new Set<Key>();
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const notify = () => listeners.forEach((fn) => fn());

const isSigned = (url: string) => /[?&](X-Amz-Signature|Signature)=/.test(url);

const usable = (e: Entry) => !e.u || !isSigned(e.u) || Date.now() - e.t < SIGNED_MAX_AGE_MS;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const entries = [...cache.entries()].slice(-MAX_ENTRIES);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries))).catch(() => {});
  }, 500);
}

// Idratazione all'avvio: quello che il server ha già detto vince sempre.
void AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as Record<Key, Entry>;
    let changed = false;
    for (const [key, entry] of Object.entries(saved) as [Key, Entry][]) {
      if (cache.has(key) || !entry || typeof entry.t !== 'number' || !usable(entry)) continue;
      cache.set(key, entry);
      changed = true;
    }
    if (changed) notify();
  })
  .catch(() => {});

async function flush() {
  flushTimer = null;
  const batch = [...queued];
  queued.clear();
  batch.forEach((key) => inflight.add(key));

  const userIds = batch.filter((k) => k.startsWith('u:')).map((k) => k.slice(2));
  const instructorIds = batch.filter((k) => k.startsWith('i:')).map((k) => k.slice(2));

  try {
    const res = await regloApi.getUserPhotos(userIds, instructorIds);
    const now = Date.now();
    batch.forEach((key) => {
      const id = key.slice(2);
      const url = (key.startsWith('u:') ? res.users[id] : res.instructors[id]) ?? null;
      const prev = cache.get(key);
      // Stesso file con una firma nuova: si tiene l'URL già caricato.
      const same = prev?.u && url && prev.u.split('?')[0] === url.split('?')[0] && !isSigned(url);
      cache.set(key, same ? { u: prev!.u, t: now } : { u: url, t: now });
      fresh.add(key);
    });
    scheduleSave();
  } catch {
    // Rete assente: resta la copia salvata; senza copia, le iniziali.
    batch.forEach((key) => {
      if (!cache.has(key)) cache.set(key, { u: null, t: 0 });
    });
  } finally {
    batch.forEach((key) => inflight.delete(key));
    notify();
  }
}

function requestKey(key: Key) {
  if (fresh.has(key) || inflight.has(key) || queued.has(key)) return;
  queued.add(key);
  if (!flushTimer) flushTimer = setTimeout(() => void flush(), 60);
}

/** Invalida la foto di un utente (es. dopo un upload) e la richiede di nuovo. */
export function invalidateUserPhoto(userId: string) {
  const key = `u:${userId}` as Key;
  cache.delete(key);
  fresh.delete(key);
  notify();
  requestKey(key);
}

/** Uscita dall'account: niente foto di un'altra autoscuola alla prossima sessione. */
export function clearUserPhotoCache() {
  cache.clear();
  fresh.clear();
  notify();
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  clearPhotoDiskCache();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** `undefined` = ancora da sapere (skeleton), `null` = nessuna foto (iniziali). */
function usePhotoByKey(key: Key | null): string | null | undefined {
  const url = useSyncExternalStore(subscribe, () => {
    if (!key) return null;
    const e = cache.get(key);
    return e ? e.u : undefined;
  });
  useEffect(() => {
    if (key) requestKey(key);
  }, [key]);
  return url;
}

/** URL foto profilo per uno userId/studentId (undefined finché non si sa, null se assente). */
export const useUserPhotoUrl = (userId?: string | null) =>
  usePhotoByKey(userId ? (`u:${userId}` as Key) : null);

/** URL foto profilo per un AutoscuolaInstructor.id. */
export const useInstructorPhotoUrl = (instructorId?: string | null) =>
  usePhotoByKey(instructorId ? (`i:${instructorId}` as Key) : null);
