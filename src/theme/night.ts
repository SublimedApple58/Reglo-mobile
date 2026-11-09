import { createContext, useContext } from 'react';
import type { ViewStyle } from 'react-native';

/**
 * Ricca 7 (07/11/2026) — fogli scuri sopra Road di notte.
 *
 * Lo stack `/road` fornisce `SheetNightContext` (notte di Road, automatica o
 * forzata dall'istruttore). `FormSheet` e i componenti clay lo leggono da soli:
 * fuori da Road vale sempre `false` e niente cambia.
 *
 * Stessi grigi della palette `NIGHT` della guida dal vivo (`src/road/night.ts`):
 * mai nero pieno né bianco pieno, mai blu.
 */
export const SheetNightContext = createContext(false);

export const useSheetNight = () => useContext(SheetNightContext);

export const SHEET_NIGHT = {
  /** Fondo del foglio. */
  bg: '#1C1C1E',
  /** Card, liste, campi, bottoni secondari. */
  surface: '#2C2C2E',
  ink: '#F2F2F2',
  ink2: 'rgba(242,242,242,0.78)',
  ink3: 'rgba(242,242,242,0.56)',
  /** Placeholder, disattivi. */
  ink4: 'rgba(242,242,242,0.38)',
  hair: 'rgba(255,255,255,0.12)',
  pressed: 'rgba(255,255,255,0.08)',
  chevron: 'rgba(242,242,242,0.32)',
} as const;

/**
 * Ombre clay di notte: le ombre scure sul fondo scuro non si vedono, il volume
 * lo dà un bordo di luce appena accennato più un'ombra nera morbida.
 */
export const SHEET_NIGHT_SHADOW = {
  raise: {
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: 'rgba(255,255,255,0.06)' },
      { offsetX: 0, offsetY: 10, blurRadius: 24, spreadDistance: -10, color: 'rgba(0,0,0,0.5)' },
    ],
  },
  sink: {
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: 'rgba(255,255,255,0.06)', inset: true },
      { offsetX: 0, offsetY: 2, blurRadius: 5, spreadDistance: 0, color: 'rgba(0,0,0,0.35)', inset: true },
    ],
  },
} satisfies Record<string, ViewStyle>;
