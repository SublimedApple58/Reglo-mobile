import * as Haptics from './haptics';

// Light tactile tick whenever a screen finishes closing (X, CTA back, or
// swipe-down dismiss of a formSheet / page sheet). Wire into a Stack via
// `screenListeners={sheetScreenListeners}`. `e.data.closing` is true only on
// dismissal (not when a screen transitions in), so it fires once per close.
export const sheetScreenListeners = {
  transitionEnd: (e: any) => {
    if (e?.data?.closing) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  },
};
