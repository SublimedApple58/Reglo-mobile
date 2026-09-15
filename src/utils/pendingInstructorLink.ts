/**
 * REG-451 — codice arrivato da un deep link `associa-istruttore?code=` (pagina
 * web /i/<codice> aperta dalla fotocamera). Lo teniamo qui finché la sessione
 * non è pronta: se l'allievo deve prima fare login, l'AuthGate lo consuma dopo.
 */
let pendingCode: string | null = null;
const listeners = new Set<() => void>();

/** Avvisa chi aspetta (AuthGate) quando arriva un link con l'app già aperta. */
export function subscribePendingInstructorLink(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const INSTRUCTOR_LINK_ROUTE = '/(tabs)/settings/associa-istruttore';

export function setPendingInstructorLinkCode(code: string | null) {
  pendingCode = code;
  if (code) listeners.forEach((l) => l());
}

export function takePendingInstructorLinkCode(): string | null {
  const code = pendingCode;
  pendingCode = null;
  return code;
}

/** Estrae il codice da un path/URL di sistema, se è un link di associazione. */
export function instructorCodeFromSystemPath(path: string): string | null {
  const match = path.match(/associa-istruttore\/?\?(?:.*&)?code=([^&#]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1];
  }
}
