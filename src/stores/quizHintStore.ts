type QuizHintData = {
  title: string;
  descriptionHtml: string;
};

let _data: QuizHintData | null = null;
const _listeners = new Set<() => void>();

export const quizHintStore = {
  set(data: QuizHintData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): QuizHintData | null {
    return _data;
  },
  clear() {
    _data = null;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
