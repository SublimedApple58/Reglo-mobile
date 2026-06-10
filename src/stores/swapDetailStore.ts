import type { AutoscuolaSwapOfferWithDetails } from '../types/regloApi';

type SwapDetailData = {
  offer: AutoscuolaSwapOfferWithDetails;
  /** When true the offer was created by the viewer → show revoke instead of accept. */
  mine?: boolean;
  onAccept?: (offerId: string) => void;
  onRevoke?: (offerId: string) => void;
};

let _data: SwapDetailData | null = null;
const _listeners = new Set<() => void>();

export const swapDetailStore = {
  set(data: SwapDetailData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): SwapDetailData | null {
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
