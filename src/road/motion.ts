import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

/**
 * REG-638 — movimento di Road (design-system §8). Niente compare o sparisce di
 * botto: cambi di stato, card, righe e banner entrano ed escono con queste
 * transizioni.
 *
 * Carattere (Tiziano 27/10): sobrio e morbido, NIENTE rimbalzi. Solo timing con
 * easing che decelera (nessun overshoot); dove serve una molla, smorzata e con
 * `overshootClamping`.
 *
 * Tutte `ReduceMotion.Never`: «Riduci movimento» non spegne nulla (regola fissa
 * di Tiziano), mentre il default di Reanimated lo farebbe.
 */
const N = ReduceMotion.Never;
const SOFT = Easing.bezier(0.25, 0.1, 0.25, 1);
const DECEL = Easing.out(Easing.cubic);

/** Spring senza rimbalzo per `withSpring` (scala al tocco, controllo segmentato). */
export const ROAD_SPRING = { damping: 30, stiffness: 260, overshootClamping: true } as const;

/** Posizione/altezza che cambia: scivola e si ferma, senza rimbalzo. */
export const ROAD_LAYOUT = LinearTransition.duration(300).easing(SOFT).reduceMotion(N);

/** Card o blocco che entra: dissolvenza con un breve scivolamento dal basso. */
export const roadEnter = (delay = 0) => FadeInDown.duration(320).delay(delay).easing(DECEL).reduceMotion(N);

/** Riga di lista che entra: cascata di 40 ms. */
export const roadStagger = (i: number) => roadEnter(i * 40);

/** Uscita: dissolvenza breve con un filo di salita. */
export const ROAD_EXIT = FadeOutUp.duration(200).easing(DECEL).reduceMotion(N);

/** Testo che cambia (briefing, sottotitolo): dissolvenza incrociata breve. */
export const ROAD_TEXT_IN = FadeIn.duration(220).easing(SOFT).reduceMotion(N);
export const ROAD_TEXT_OUT = FadeOut.duration(140).easing(SOFT).reduceMotion(N);
