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
 * Movimento morbido di Reglo (design-system §8), nato con Road (REG-638) e
 * usato anche da `FormSheet`. Niente compare o sparisce di
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

/**
 * Cursore di un controllo segmentato / scelta istantanea: 200 ms morbidi,
 * senza rimbalzo. Tempo fisso (non una molla): `ROAD_SPRING` impiega ~0,5 s
 * ad arrivare (smorzamento appena sotto il critico), troppo per un tocco.
 */
export const SEGMENT_TIMING = { duration: 200, easing: SOFT, reduceMotion: N } as const;

/** Posizione/altezza che cambia: scivola e si ferma, senza rimbalzo. */
export const ROAD_LAYOUT = LinearTransition.duration(300).easing(SOFT).reduceMotion(N);

/** Card o blocco che entra: dissolvenza con un breve scivolamento dal basso. */
export const roadEnter = (delay = 0) => FadeInDown.duration(320).delay(delay).easing(DECEL).reduceMotion(N);

/** Riga di lista che entra: cascata di 40 ms. */
export const roadStagger = (i: number) => roadEnter(i * 40);

/** Uscita: dissolvenza breve con un filo di salita. */
export const ROAD_EXIT = FadeOutUp.duration(200).easing(DECEL).reduceMotion(N);

/**
 * Card che se ne va lasciando posto (es. «Più tardi»): prima sparisce in fretta,
 * POI il resto sale (`ROAD_LAYOUT_AFTER_EXIT`), così le due cose non si
 * sovrappongono a metà transizione.
 */
export const ROAD_CARD_EXIT = FadeOut.duration(140).easing(SOFT).reduceMotion(N);
export const ROAD_LAYOUT_AFTER_EXIT = LinearTransition.duration(320).delay(130).easing(SOFT).reduceMotion(N);

/**
 * Testo che cambia (briefing, sottotitolo): in sequenza, non sovrapposto. Il
 * vecchio sparisce in 110 ms, il nuovo entra dopo: mai due testi uno sull'altro.
 */
export const ROAD_TEXT_IN = FadeIn.duration(200).delay(110).easing(SOFT).reduceMotion(N);
export const ROAD_TEXT_OUT = FadeOut.duration(110).easing(SOFT).reduceMotion(N);

// Nomi generici (FormSheet e codice nuovo); i ROAD_* restano come alias.
export const SOFT_LAYOUT = ROAD_LAYOUT;
export const softEnter = roadEnter;
export const softStagger = roadStagger;
export const SOFT_EXIT = ROAD_EXIT;
export const SOFT_TEXT_IN = ROAD_TEXT_IN;
export const SOFT_TEXT_OUT = ROAD_TEXT_OUT;
export const SOFT_CARD_EXIT = ROAD_CARD_EXIT;
export const SOFT_LAYOUT_AFTER_EXIT = ROAD_LAYOUT_AFTER_EXIT;
export const SOFT_SPRING = ROAD_SPRING;
