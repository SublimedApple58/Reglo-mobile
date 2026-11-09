/**
 * Drives the `home/agenda-scope` form sheet «Quale agenda?» — aperto dal
 * selettore in testa all'Agenda (titolare e titolare-istruttore). Chi lo apre
 * semina gli istruttori già in memoria (dal bootstrap dell'agenda: nessuna
 * chiamata di rete) e la scelta attuale; il tocco su una riga richiama
 * `onPick` e chiude.
 */
export type AgendaScope =
  | { kind: 'personal' }
  | { kind: 'all' }
  | { kind: 'instructor'; instructorId: string };

export type AgendaScopeInstructor = { id: string; name: string; userId?: string | null };

export type AgendaScopeSheetData = {
  /** Titolare-istruttore: riga «Le mie guide» in cima. */
  canPickPersonal: boolean;
  /** Il proprio profilo istruttore (escluso dalla lista: è «Le mie guide»). */
  myInstructorId: string | null;
  myUserId: string | null;
  myName: string;
  instructors: AgendaScopeInstructor[];
  selected: AgendaScope;
  onPick: (scope: AgendaScope) => void;
};

let _data: AgendaScopeSheetData | null = null;
const _listeners = new Set<() => void>();

export const agendaScopeSheetStore = {
  set(data: AgendaScopeSheetData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): AgendaScopeSheetData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};

export const sameScope = (a: AgendaScope, b: AgendaScope) =>
  a.kind === b.kind && (a.kind !== 'instructor' || (b.kind === 'instructor' && a.instructorId === b.instructorId));
