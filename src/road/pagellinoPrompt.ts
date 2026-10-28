/**
 * Foglio «Appena finita» della tab Road (Tiziano 28/10/2026): si apre da solo
 * UNA volta per guida finita col pagellino da compilare. Chiuso (X, «Più
 * tardi» o aperto il pagellino) non ricompare fino al prossimo avvio
 * dell'app: lo stato vive solo in memoria, di proposito non persistito.
 */
const shown = new Set<string>();

export const pagellinoPrompt = {
  /** true se il foglio per questa sessione non è ancora stato mostrato. */
  shouldShow: (sessionId: string) => !shown.has(sessionId),
  markShown: (sessionId: string) => {
    shown.add(sessionId);
  },
};
