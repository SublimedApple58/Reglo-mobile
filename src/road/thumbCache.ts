import * as FileSystem from 'expo-file-system/legacy';

/**
 * Snapshot delle miniature di percorso («Ultime guide», fluidità 29/10): la
 * mappa Apple di una riga si disegna una volta sola, poi resta come immagine
 * in `cacheDirectory/route-thumbs/`. La chiave dipende da zona, traccia e
 * misura: un percorso diverso è un file diverso.
 */
const DIR = `${FileSystem.cacheDirectory ?? ''}route-thumbs/`;
let onDisk: Set<string> | null = null;

void (async () => {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    onDisk = new Set(info.exists ? await FileSystem.readDirectoryAsync(DIR) : []);
  } catch {
    onDisk = new Set();
  }
})();

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export function thumbKey(region: Region, track: Array<[number, number]> | null, size: number): string {
  const r = (n: number) => n.toFixed(5);
  let src = `${r(region.latitude)},${r(region.longitude)},${r(region.latitudeDelta)},${r(region.longitudeDelta)}|${size}|`;
  if (track) src += track.map(([a, b]) => `${r(a)},${r(b)}`).join(';');
  let h = 5381;
  for (let i = 0; i < src.length; i += 1) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}-${src.length.toString(36)}.png`;
}

/** File già pronto per questa miniatura, se c'è (lettura sincrona dell'indice). */
export function cachedThumbUri(key: string): string | null {
  return onDisk?.has(key) ? `${DIR}${key}` : null;
}

/** Sposta lo snapshot appena fatto nella cache; restituisce l'URI o null. */
export async function saveThumbSnapshot(key: string, file: string): Promise<string | null> {
  try {
    const from = file.startsWith('file://') ? file : `file://${file}`;
    await FileSystem.moveAsync({ from, to: `${DIR}${key}` });
    onDisk?.add(key);
    return `${DIR}${key}`;
  } catch {
    return null;
  }
}
