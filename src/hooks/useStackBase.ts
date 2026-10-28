import { useSegments } from 'expo-router';

/**
 * Cartella dello stack in cui vive la schermata corrente (`home`, `role`,
 * `more`…), per aprire i fogli registrati in più stack nello stack giusto:
 * `router.push(\`/(tabs)/${base}/time-picker\`)`.
 *
 * REG-639 fluidità: Disponibilità si apre ora come push nello stack Agenda
 * (`home/availability`, con lo swipe indietro nativo) e resta anche nella tab
 * `role/`; i suoi fogli esistono in entrambi.
 */
export function useStackBase(fallback = 'role'): string {
  const segments = useSegments() as string[];
  return segments[0] === '(tabs)' && segments[1] ? segments[1] : fallback;
}
