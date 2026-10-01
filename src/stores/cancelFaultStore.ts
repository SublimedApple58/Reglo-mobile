/**
 * Drives the `home/cancel-fault` form sheet (REG-587) — la domanda "di chi è
 * l'imprevisto?" quando lo staff annulla una guida ALL'ULTIMO (oltre il limite
 * di preavviso). La risposta non è una scelta economica ma una constatazione:
 * se l'imprevisto è dell'autoscuola l'allievo non paga nessuna penale e la
 * guida non finisce nella coda "Cancellazioni tardive" del titolare.
 *
 * Il chiamante (IstruttoreHomeScreen via manage-lesson) pubblica il contesto
 * della guida + la callback che esegue l'annullamento, poi pusha la route.
 */
export type CancelFault = 'student' | 'school';

export type CancelFaultData = {
  /** Nome dell'allievo, per parlare di persone e non di "l'allievo". */
  studentName: string;
  /** Riga di contesto: giorno · orario della guida. */
  whenLabel: string;
  /** Quanto manca all'inizio, già formattato ("2h 15min"). */
  countdownLabel: string;
  /** Cosa c'è in gioco: credito del pacchetto, soldi, o niente. */
  coverage: 'credit' | 'money' | 'none';
  /** Esegue l'annullamento con la responsabilità scelta. */
  onPick: (fault: CancelFault) => void;
};

let _data: CancelFaultData | null = null;
const _listeners = new Set<() => void>();

export const cancelFaultStore = {
  set(data: CancelFaultData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): CancelFaultData | null {
    return _data;
  },
  clear() {
    _data = null;
    _listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
