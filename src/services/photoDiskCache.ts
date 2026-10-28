import { useEffect, useSyncExternalStore } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Cache su disco delle foto remote (avatar, sede). Giro Road, Tiziano 28/10:
 * alla seconda apertura le foto devono essere già lì. Le foto profilo sono
 * PNG originali da ~2 MB senza Cache-Control: la cache HTTP di iOS non le
 * tiene, quindi si scaricavano a ogni avvio. Qui si salvano una volta in
 * `cacheDirectory/photos/` e poi si leggono dal file (decodifica locale).
 * Niente expo-image (modulo nativo assente dal binario 2.4.0).
 */

const DIR = `${FileSystem.cacheDirectory ?? ''}photos/`;

/** Nomi dei file già sul disco; `null` finché la cartella non è letta. */
let onDisk: Set<string> | null = null;
const downloading = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

/** Stesso oggetto anche con firma diversa: la chiave ignora la query. */
function fileNameFor(url: string): string {
  const base = url.split('?')[0];
  let h = 5381;
  for (let i = 0; i < base.length; i += 1) h = ((h << 5) + h + base.charCodeAt(i)) | 0;
  const ext = /\.(png|jpe?g|webp|heic)$/i.exec(base)?.[1]?.toLowerCase() ?? 'img';
  return `${(h >>> 0).toString(36)}-${base.length.toString(36)}.${ext}`;
}

void (async () => {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    onDisk = new Set(info.exists ? await FileSystem.readDirectoryAsync(DIR) : []);
  } catch {
    onDisk = new Set();
  }
  notify();
})();

async function download(url: string, name: string) {
  if (downloading.has(name) || !onDisk || onDisk.has(name)) return;
  downloading.add(name);
  const tmp = `${DIR}${name}.part`;
  try {
    const res = await FileSystem.downloadAsync(url, tmp);
    if (res.status >= 200 && res.status < 300) {
      await FileSystem.moveAsync({ from: tmp, to: `${DIR}${name}` });
      onDisk.add(name);
      // Niente notify: la foto a schermo resta quella remota (nessuna seconda
      // dissolvenza); il file vale dalla prossima volta.
    } else {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
    }
  } catch {
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
  } finally {
    downloading.delete(name);
  }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/**
 * URI da mostrare per una foto: il file locale se c'è, altrimenti l'URL
 * remoto (e intanto lo salva). `undefined` solo nei primi millisecondi,
 * finché la cartella non è letta (lo skeleton copre).
 */
export function useCachedPhotoUri(url: string | null | undefined): string | null | undefined {
  const remote = url && /^https?:\/\//.test(url) ? url : null;
  const name = remote ? fileNameFor(remote) : null;
  const ready = useSyncExternalStore(subscribe, () => onDisk !== null);
  const local = ready && name && onDisk!.has(name) ? `${DIR}${name}` : null;
  useEffect(() => {
    if (remote && name && ready && !local) void download(remote, name);
  }, [remote, name, ready, local]);
  if (!remote) return url;
  if (!ready) return undefined;
  return local ?? remote;
}

/** Uscita dall'account: via le foto salvate. */
export function clearPhotoDiskCache() {
  onDisk = new Set();
  void FileSystem.deleteAsync(DIR, { idempotent: true })
    .then(() => FileSystem.makeDirectoryAsync(DIR, { intermediates: true }))
    .catch(() => {});
}
