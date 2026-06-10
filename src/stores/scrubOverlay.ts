import { makeMutable } from 'react-native-reanimated';

/**
 * Screen-level scrub bubble state shared between any BookableBand and the single
 * <ScrubBubble> overlay mounted at the screen root. Position is driven by
 * reanimated shared values (UI thread, follows the finger across the whole
 * screen); the time label is a tiny pub/sub (updated only on 15-min step change).
 */
export const scrubX = makeMutable(0);
export const scrubY = makeMutable(0);
export const scrubActive = makeMutable(0);

let _label = '';
const _listeners = new Set<() => void>();
export const scrubLabel = {
  set(v: string) {
    if (v === _label) return;
    _label = v;
    _listeners.forEach((fn) => fn());
  },
  get() {
    return _label;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
};
