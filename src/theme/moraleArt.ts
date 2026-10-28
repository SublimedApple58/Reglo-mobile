import type { ImageSourcePropType } from 'react-native';

/**
 * Icone 3D «di morale» (design-system §0.4, REG-639 notte 28/10): generate su
 * Gemini con il blocco STILE, usate SOLO negli stati vuoti, nei traguardi e
 * nella testata del foglio esame — mai come decorazione delle righe. Un po' di
 * calore, sempre premium. 84 pt, `@2x`/`@3x` (`assets/morale/`).
 */
export const MORALE_ART = {
  /** «Giornata libera» (agenda). */
  espresso: require('../../assets/morale/espresso.png'),
  /** «Nessuna notifica». */
  aeroplanino: require('../../assets/morale/aeroplanino.png'),
  /** Liste vuote: luoghi, veicoli. */
  piantina: require('../../assets/morale/piantina.png'),
  /** Traguardi (ore di guida). */
  trofeo: require('../../assets/morale/trofeo.png'),
  /** Testata del foglio esame. */
  esame: require('../../assets/morale/esame.png'),
} satisfies Record<string, ImageSourcePropType>;
