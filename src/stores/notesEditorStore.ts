/**
 * Generic seed-and-callback store for the `home/edit-notes` form sheet:
 * a single multiline notes editor with a Salva button. The opener seeds the
 * initial text and an async `onSave`; the route pops itself when save succeeds.
 *
 * Used by: manage-group-lesson (note della guida di gruppo).
 */
export type NotesEditorData = {
  title: string;
  subtitle?: string;
  placeholder?: string;
  initial: string;
  /** Persist the new text. Return true to close the sheet, false to keep it open. */
  onSave: (text: string) => Promise<boolean>;
};

let _data: NotesEditorData | null = null;
const _listeners = new Set<() => void>();

export const notesEditorStore = {
  set(data: NotesEditorData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): NotesEditorData | null {
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
