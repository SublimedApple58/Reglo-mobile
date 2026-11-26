/**
 * «Oggi» → Agenda (REG-794, rilascio 2). «Oggi» non apre fogli dell'Agenda nel
 * suo stack: chiede all'Agenda di mostrarsi così, poi passa alla tab.
 * - `mine`: «La mia» (titolare-istruttore), oggi;
 * - `week`: la settimana di un istruttore (la propria = «La mia»);
 * - `sick`: la settimana di un istruttore con il foglio «Malattia o ferie» aperto.
 * L'Agenda la esegue appena può (anche al primo montaggio) e la consuma.
 */
export type OwnerAgendaRequest =
  | { kind: 'mine' }
  | { kind: 'week'; instructorId: string }
  | { kind: 'sick'; instructorId: string };

let _data: OwnerAgendaRequest | null = null;
const _listeners = new Set<() => void>();
const emit = () => _listeners.forEach((fn) => fn());

export const ownerAgendaRequestStore = {
  set(data: OwnerAgendaRequest) {
    _data = data;
    emit();
  },
  get(): OwnerAgendaRequest | null {
    return _data;
  },
  clear() {
    if (!_data) return;
    _data = null;
    emit();
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
