/**
 * REG-585 — gestione dei colleghi su una guida di gruppo o un esame, dal
 * telefono. Il web ha i chip nel dialogo di gestione; qui è un foglio a parte,
 * come il picker dell'istruttore principale (`manage-lesson-instructor`).
 *
 * Chi apre il foglio pubblica lo stato attuale + chi è il principale (mostrato
 * in cima ma bloccato: non può essere collega di se stesso) e una `onToggle`
 * che salva. Il salvataggio è immediato a ogni tocco — niente bottone di conferma,
 * così non c'è una CTA che gli sheet Android possono tagliare, ed è lo stesso
 * comportamento del picker singolo.
 */
export type CoInstructorPickerData = {
  /** L'istruttore principale: mostrato in cima, bloccato, non togglabile. */
  mainInstructorId: string | null;
  /** Id dei colleghi attualmente assegnati. */
  selectedIds: string[];
  /** Testo sotto il titolo: cambia fra guida di gruppo ed esame. */
  subtitle: string;
  /**
   * Salva la nuova lista completa. Deve RISOLVERE quando il backend ha
   * confermato (il foglio mostra lo spinner fino ad allora) e rilanciare in
   * caso di errore, così la riga torna com'era.
   */
  onToggle: (nextIds: string[]) => Promise<void>;
};

let _data: CoInstructorPickerData | null = null;
const _listeners = new Set<() => void>();

export const coInstructorPickerStore = {
  set(data: CoInstructorPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): CoInstructorPickerData | null {
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
