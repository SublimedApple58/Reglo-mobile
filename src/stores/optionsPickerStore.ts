/**
 * Drives the `home/select-options` form sheet — a small reusable single/multi
 * select used by the "Nuova prenotazione" form for Durata, Veicolo and Tipo.
 * The opener publishes the title, the options, the current selection and an
 * onConfirm callback, then pushes the route. Single-select applies on tap and
 * pops; multi-select toggles locally and applies on the confirm CTA.
 */
export type OptionItem = {
  value: string;
  label: string;
  subtitle?: string | null;
  /** When set, the row shows a neutral leading avatar with these initials
   *  (used by the "Aggiungi allievo" picker to read as a student list). */
  leadingInitials?: string | null;
  /** userId per mostrare la foto profilo al posto delle iniziali, se presente. */
  leadingUserId?: string | null;
  /**
   * REG-636 — tono del sottotitolo: `success` (verde, con pallino: «Libera»)
   * o `accent` (arancio moto, con icona scambio: «Con Luca B. · scambio»).
   */
  subtitleTone?: 'success' | 'accent' | null;
  /** REG-636 — iniziali in coda al posto del cerchio di selezione (chi ha già la moto). */
  trailingInitials?: string | null;
};

export type OptionsPickerData = {
  title: string;
  /** Riga di servizio sotto il titolo: dice cosa si sta scegliendo. */
  hint?: string | null;
  options: OptionItem[];
  selected: string[];
  multi: boolean;
  /** Etichetta della CTA nei picker multipli (default "Conferma"). */
  confirmLabel?: string;
  /**
   * Cosa scrivere quando la ricerca non trova niente. Il picker e' condiviso
   * (allievi, veicoli, durate), quindi il testo lo decide chi lo apre;
   * default generico.
   */
  emptyLabel?: string;
  /** Riga di servizio sotto la lista (es. quali moto non compaiono e perché). */
  footnote?: string | null;
  /**
   * `mono`: bianco/nero senza navy (selezione, spunta, CTA nera piena). Lo usa
   * Reglo Road, dove nessun bottone è navy (REG-638).
   */
  tone?: 'mono';
  onConfirm: (values: string[]) => void;
};

let _data: OptionsPickerData | null = null;
const _listeners = new Set<() => void>();

/**
 * Route to push AFTER optionsPickerStore.set(): short lists open the
 * content-hugging form sheet, long ones the scrollable page sheet — a form
 * sheet clips past-the-fold rows with no scroll (bug "Aggiungi allievo",
 * 2026-07-07) and a ScrollView inside fitToContents breaks the measuring.
 */
export const LONG_PICKER_THRESHOLD = 7;

/**
 * Da quante voci il foglio si porta dietro un campo di ricerca (REG-617).
 *
 * Non sempre: su una lista corta la ricerca e' un ingombro che allontana la
 * prima riga dal pollice. Oltre questa soglia e' il contrario — scorrere
 * centinaia di allievi a mano non e' una risposta (segnalazione Robatto, 14/10:
 * 256 allievi idonei). La ricerca compare **solo nel foglio che scorre**: in un
 * `fitToContents` il filtro cambierebbe l'altezza a ogni lettera, e quel foglio
 * non si rimisura.
 */
export const PICKER_SEARCH_THRESHOLD = 8;
export const shouldShowPickerSearch = (count: number, scrollable: boolean) =>
  scrollable && count > PICKER_SEARCH_THRESHOLD;
export const optionsPickerPath = () =>
  (_data?.options.length ?? 0) > LONG_PICKER_THRESHOLD
    ? ('/(tabs)/home/select-options-long' as const)
    : ('/(tabs)/home/select-options' as const);

export const optionsPickerStore = {
  set(data: OptionsPickerData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): OptionsPickerData | null {
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
