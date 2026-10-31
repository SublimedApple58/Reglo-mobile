import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

/**
 * REG-697 Reglo Road — avvisi sonori sobri.
 *
 * Col telefono nel supporto la vibrazione non si sente: due toni brevi (già nel
 * bundle, niente rete). `alert` = punto critico in arrivo (due note che
 * scendono), `chime` = tappa e fine guida (due note che salgono). La musica
 * dell'auto si abbassa per un attimo (ducking) invece di fermarsi; si sentono
 * anche col tasto silenzioso, come i navigatori. Un tasto li spegne e la scelta
 * resta (AsyncStorage). `expo-av` è già nel binario 2.4.0: niente build.
 */

export type RoadSound = 'alert' | 'chime';

const KEY = 'reglo-road-sound-muted';
const SOURCES: Record<RoadSound, number> = {
  alert: require('../../assets/sounds/road-alert.wav'),
  chime: require('../../assets/sounds/road-chime.wav'),
};

let muted = false;
let loaded: Promise<void> | null = null;
const sounds: Partial<Record<RoadSound, Audio.Sound>> = {};
const listeners = new Set<() => void>();

function load() {
  if (!loaded) {
    loaded = (async () => {
      try {
        muted = (await AsyncStorage.getItem(KEY)) === '1';
        listeners.forEach((fn) => fn());
      } catch {
        // resta acceso
      }
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          playThroughEarpieceAndroid: false,
        });
        for (const k of Object.keys(SOURCES) as RoadSound[]) {
          const { sound } = await Audio.Sound.createAsync(SOURCES[k], { volume: 1 });
          sounds[k] = sound;
        }
      } catch {
        // niente audio: restano le vibrazioni
      }
    })();
  }
  return loaded;
}

export const roadSounds = {
  /** Si chiama all'ingresso nella guida live: i suoni sono pronti al primo avviso. */
  prepare() {
    void load();
  },

  async play(kind: RoadSound) {
    await load();
    if (muted) return;
    try {
      await sounds[kind]?.replayAsync();
    } catch {
      // un suono perso non deve mai fermare la guida
    }
  },

  get muted() {
    return muted;
  },

  setMuted(next: boolean) {
    muted = next;
    listeners.forEach((fn) => fn());
    AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => undefined);
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function useRoadSoundMuted(): boolean {
  return useSyncExternalStore(roadSounds.subscribe, () => roadSounds.muted, () => roadSounds.muted);
}
