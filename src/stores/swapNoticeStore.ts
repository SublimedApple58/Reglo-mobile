/**
 * REG-789 — avviso da mostrare nella tab Scambi dopo un'azione fatta in un
 * foglio (es. «Lascia una guida»): il foglio si chiude e il toast compare
 * sulla schermata sotto, non dentro il foglio che sta sparendo.
 */
type SwapNotice = { text: string; tone: 'success' | 'info' | 'danger' };

let _notice: SwapNotice | null = null;
const _listeners = new Set<() => void>();

export const swapNoticeStore = {
  set(notice: SwapNotice) {
    _notice = notice;
    _listeners.forEach((fn) => fn());
  },
  /** Prende l'avviso e lo toglie (si mostra una volta sola). */
  take(): SwapNotice | null {
    const n = _notice;
    _notice = null;
    return n;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
