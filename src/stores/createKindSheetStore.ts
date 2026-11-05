import type { AgendaCreateKind } from '../components/WeeklyAgendaView';

/**
 * Drives the `home/create-kind` form sheet «Cosa vuoi creare?» — aperto dalla
 * barra del blocco fantasma dell'Agenda («Guida ⌄»). Chi lo apre semina i tipi
 * offerti, quello scelto, la riga con giorno e fascia e il colore dell'auto;
 * il tocco su una riga richiama `onPick` e chiude.
 */
export type CreateKindSheetData = {
  kinds: AgendaCreateKind[];
  selected: AgendaCreateKind;
  /** «Venerdì 6 novembre · 13:00 – 14:00». */
  subtitle: string;
  /** Colore del veicolo dell'istruttore: l'auto 3D della riga «Guida». */
  carColor?: string | null;
  onPick: (kind: AgendaCreateKind) => void;
};

let _data: CreateKindSheetData | null = null;
const _listeners = new Set<() => void>();

export const createKindSheetStore = {
  set(data: CreateKindSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): CreateKindSheetData | null {
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
