import {
  instructorCodeFromSystemPath,
  setPendingInstructorLinkCode,
} from '../src/utils/pendingInstructorLink';

/**
 * Riscrive i link di sistema prima che expo-router li risolva.
 * REG-451: `…://associa-istruttore?code=X` (dalla pagina web del QR istruttore)
 * → atterra sulla home e l'AuthGate apre il flusso di associazione appena la
 * sessione è pronta (anche dopo un login).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const code = instructorCodeFromSystemPath(path);
    if (code) {
      setPendingInstructorLinkCode(code);
      return '/(tabs)/home';
    }
  } catch {
    // mai bloccare l'apertura dell'app per un link malformato
  }
  return path;
}
