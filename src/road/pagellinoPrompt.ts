import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Foglio «Appena finita» della tab Road (Tiziano 28/10/2026): si apre da solo
 * UNA volta per guida finita col pagellino da compilare. Chiuso (X, «Più
 * tardi» o aperto il pagellino) non ricompare più per quella guida.
 *
 * Road novembre (R1, 10/11/2026): prima lo stato viveva solo in memoria, così
 * a ogni riavvio dell'app (o se iOS la chiudeva tra una guida e l'altra) il
 * foglio della guida precedente tornava fuori. Ora è salvato sul telefono per
 * sessione; si tengono solo le ultime, il server lo propone al massimo per 12 h.
 */
const KEY = 'road.pagellinoPrompt.shown';
const KEEP = 20;

let shown: string[] = [];
let lastShownAt = 0;

const ready: Promise<void> = AsyncStorage.getItem(KEY)
  .then((v) => {
    const list = v ? (JSON.parse(v) as unknown) : null;
    if (Array.isArray(list)) {
      const saved = list.filter((x): x is string => typeof x === 'string');
      shown = [...shown, ...saved.filter((id) => !shown.includes(id))].slice(-KEEP);
    }
  })
  .catch(() => undefined);

export const pagellinoPrompt = {
  /** Si risolve quando lo stato salvato è stato letto (mai rifiutata). */
  ready: () => ready,
  /** true se il foglio per questa sessione non è ancora stato mostrato. */
  shouldShow: (sessionId: string) => !shown.includes(sessionId),
  markShown: (sessionId: string) => {
    if (!shown.includes(sessionId)) shown = [...shown, sessionId].slice(-KEEP);
    lastShownAt = Date.now();
    AsyncStorage.setItem(KEY, JSON.stringify(shown)).catch(() => undefined);
  },
  /** REG-658: il foglio si è aperto da poco: gli altri fogli automatici aspettano. */
  shownRecently: (ms = 5_000) => Date.now() - lastShownAt < ms,
};
