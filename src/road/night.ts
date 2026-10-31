import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { roadStore } from './roadStore';
import { CLAY } from '../theme';

/**
 * REG-697 Reglo Road — mappa notte automatica.
 *
 * Alba e tramonto dal punto in cui si è (formula NOAA semplificata, errore di
 * un paio di minuti: basta). È «notte» da 15 minuti prima del tramonto a 15
 * minuti dopo l'alba, così d'inverno la guida delle 17 parte già scura. Si
 * ricontrolla ogni minuto. Senza posizione: Torino.
 */

const RAD = Math.PI / 180;
const EDGE_MS = 15 * 60_000;
const FALLBACK = { lat: 45.07, lng: 7.68 };

/** Alba e tramonto (ms epoch) del giorno di `at` nel punto dato; null = sole sempre su/giù. */
export function sunTimes(at: number, lat: number, lng: number): { rise: number; set: number } | null {
  const day = Math.floor(at / 86_400_000);
  const n = day - 10_957; // giorni dal 1/1/2000 (00:00 UTC)
  const jStar = n - lng / 360;
  const m = (357.5291 + 0.98560028 * jStar) % 360;
  const c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD);
  const lambda = (m + c + 180 + 102.9372) % 360;
  const jTransit = jStar + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const decl = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.44 * RAD));
  const cosH =
    (Math.sin(-0.83 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return null;
  const h = Math.acos(cosH) / RAD / 360;
  const base = 946_728_000_000; // 1/1/2000 12:00 UTC
  return { rise: base + (jTransit - h) * 86_400_000, set: base + (jTransit + h) * 86_400_000 };
}

export function isNight(at: number, lat: number, lng: number): boolean {
  const t = sunTimes(at, lat, lng);
  if (!t) return false;
  return at < t.rise + EDGE_MS || at > t.set - EDGE_MS;
}

function currentNight(): boolean {
  const fix = roadStore.get().fix;
  const p = fix ?? FALLBACK;
  return isNight(Date.now(), p.lat, p.lng);
}

/** Notte sì/no per la schermata live, aggiornata ogni minuto. */
export function useRoadNight(): boolean {
  const [night, setNight] = useState(currentNight);
  useEffect(() => {
    const t = setInterval(() => setNight(currentNight()), 60_000);
    return () => clearInterval(t);
  }, []);
  return night;
}

/**
 * Colori della guida live di notte: solo grigi e nero (mai blu). Le superfici
 * restano «sollevate» ma scure, il testo chiaro senza bianco pieno abbagliante.
 */
export type RoadPalette = {
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  /** Testo/icona sopra un fondo `ink` (glifo della svolta, numero della tappa). */
  onInk: string;
  soft: string;
  hair: string;
};

export const DAY: RoadPalette = {
  surface: CLAY.surface,
  surface2: CLAY.surface,
  ink: CLAY.ink,
  ink2: CLAY.ink2,
  ink3: CLAY.ink3,
  onInk: '#FFFFFF',
  soft: 'rgba(17,17,17,0.06)',
  hair: 'rgba(17,17,17,0.14)',
};

export const NIGHT: RoadPalette = {
  surface: '#1C1C1E',
  surface2: '#2C2C2E',
  ink: '#F2F2F2',
  ink2: 'rgba(242,242,242,0.78)',
  ink3: 'rgba(242,242,242,0.56)',
  onInk: '#111111',
  soft: 'rgba(255,255,255,0.10)',
  hair: 'rgba(255,255,255,0.14)',
};

export const roadPalette = (night: boolean): RoadPalette => (night ? NIGHT : DAY);

/**
 * Android: Google Maps in scala di grigi scura (iOS usa la mappa scura di
 * MapKit con `userInterfaceStyle="dark"`). Niente POI, acqua grigio scuro.
 */
export const ANDROID_NIGHT_STYLE =
  Platform.OS === 'android'
    ? [
        { elementType: 'geometry', stylers: [{ color: '#1d1d1f' }] },
        { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1f' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3a3a3c' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#48484a' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f10' }] },
        { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#252527' }] },
      ]
    : undefined;
