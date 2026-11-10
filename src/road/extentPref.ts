import AsyncStorage from '@react-native-async-storage/async-storage';

import { ROAD_MARKER_EXTENTS } from '../types/regloApi';

/**
 * R7: la lunghezza della «zona» proposta nel toast è l'ultima usata
 * dall'istruttore (la prima volta 100 m). Niente impostazione a parte: chi usa
 * sempre 200 m se la ritrova, e la scelta resta un tocco.
 */
const KEY = 'road.extentM.last';
const DEFAULT = 100;
let last: number = DEFAULT;
let loaded = false;

export const extentPref = {
  get: () => last,
  async load() {
    if (loaded) return;
    loaded = true;
    try {
      const v = Number(await AsyncStorage.getItem(KEY));
      if ((ROAD_MARKER_EXTENTS as readonly number[]).includes(v)) last = v;
    } catch {
      // senza storage resta 100 m
    }
  },
  set(v: number) {
    if (!(ROAD_MARKER_EXTENTS as readonly number[]).includes(v)) return;
    last = v;
    AsyncStorage.setItem(KEY, String(v)).catch(() => undefined);
  },
};
