import * as FileSystem from 'expo-file-system/legacy';

import { apiDownloadInfo } from '../services/apiClient';
import { OSM_CELLS_VERSION, cellsAround, decodeCell } from './osmCells';
import { RoadGraph, RoadMatcher, type MatchPoint } from './osmMatch';

/**
 * REG-722 — le strade OSM della «calamita» sul telefono.
 *
 * Le celle (`reglo/lib/autoscuole/road/osm-cells.ts`, ~5,5 km l'una, pochi KB)
 * si scaricano da `/api/autoscuole/road/osm/v1/<cella>` e restano su disco in
 * `documentDirectory/road-osm/v1/`: dopo la prima volta l'aggancio funziona
 * anche offline. Una cella che non esiste (zona non coperta) lascia un file
 * `.none`, così non si richiede a ogni guida. Dopo 35 giorni una cella si
 * riscarica in sottofondo (il job rifà le celle ogni mese).
 *
 * Il grafo è uno solo per tutto l'avvio dell'app: le celle si aggiungono man
 * mano (attorno alla sede all'avvio, poi attorno all'auto). Una zona senza celle
 * resta grezza, come prima.
 */

const DIR = `${FileSystem.documentDirectory ?? ''}road-osm/v${OSM_CELLS_VERSION}/`;
const REFRESH_MS = 35 * 24 * 3600_000;
/** All'avvio: le strade entro 20 km dalla sede. */
const HOME_RADIUS_M = 20_000;
/** In guida: le celle entro 3 km dall'auto. */
const AROUND_RADIUS_M = 3_000;
const CONCURRENCY = 4;

let graph: RoadGraph | null = null;
const cells = new Map<string, Promise<void>>();
let dirReady: Promise<void> | null = null;

const ensureDir = () =>
  (dirReady ??= FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined));

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function download(key: string): Promise<'ok' | 'none' | 'error'> {
  const { url, headers } = await apiDownloadInfo(`/autoscuole/road/osm/v${OSM_CELLS_VERSION}/${key}`);
  const tmp = `${DIR}${key}.part`;
  try {
    const res = await FileSystem.downloadAsync(url, tmp, { headers });
    if (res.status === 200) {
      await FileSystem.moveAsync({ from: tmp, to: `${DIR}${key}.bin` });
      return 'ok';
    }
    await FileSystem.deleteAsync(tmp, { idempotent: true });
    if (res.status === 404) {
      await FileSystem.writeAsStringAsync(`${DIR}${key}.none`, '');
      return 'none';
    }
    return 'error';
  } catch {
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => undefined);
    return 'error';
  }
}

async function loadCell(key: string): Promise<void> {
  await ensureDir();
  const file = `${DIR}${key}.bin`;
  let info = await FileSystem.getInfoAsync(file);
  if (!info.exists) {
    const none = await FileSystem.getInfoAsync(`${DIR}${key}.none`);
    if (none.exists && Date.now() - (none.modificationTime ?? 0) * 1000 < REFRESH_MS) return;
    const res = await download(key);
    // rete giù: si riprova alla prossima richiesta
    if (res === 'error') throw new Error('cella non scaricata');
    if (res === 'none') return;
    info = await FileSystem.getInfoAsync(file);
  } else if (Date.now() - (info.modificationTime ?? 0) * 1000 > REFRESH_MS) {
    void download(key); // aggiornata per la prossima volta
  }
  const b64 = await FileSystem.readAsStringAsync(file, { encoding: FileSystem.EncodingType.Base64 });
  graph?.addWays(decodeCell(key, bytesFromBase64(b64)));
}

function ensureCells(keys: string[]): Promise<void> {
  const todo = keys.filter((k) => !cells.has(k));
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const key = todo[i++];
      const job = loadCell(key).catch(() => {
        cells.delete(key);
      });
      cells.set(key, job);
      await job;
    }
  };
  return Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => undefined);
}

function ensureGraph(lat: number, lng: number) {
  graph ??= new RoadGraph(lat, lng);
  return graph;
}

/** All'avvio dell'app istruttore: le strade attorno alla sede (in sottofondo). */
export function prefetchRoadsAround(lat: number, lng: number) {
  ensureGraph(lat, lng);
  void ensureCells(cellsAround(lat, lng, HOME_RADIUS_M));
}

/** In guida: le celle attorno all'auto (le già caricate non costano niente). */
export function ensureRoadsNear(lat: number, lng: number) {
  ensureGraph(lat, lng);
  void ensureCells(cellsAround(lat, lng, AROUND_RADIUS_M));
}

/** Una calamita nuova per una guida (dal vivo: conferma dopo 4 s). */
export function createLiveMatcher(lat: number, lng: number): RoadMatcher {
  return new RoadMatcher(ensureGraph(lat, lng));
}

export type { MatchPoint };
