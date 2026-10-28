import type { ImageSourcePropType } from 'react-native';
import { ROAD_ASSETS } from '../road/markerArt';

/**
 * REG-639 Clay v2 — icone 3D colorate (Microsoft Fluent 3D, MIT; già de-rosate)
 * per la UI: tab bar, righe di lista, card, statistiche. Il colore dell'app
 * arriva da qui e dalle foto. Le segnalazioni Road restano in `markerArt`,
 * le auto in `car34Art`. MAI `tintColor` (appiattisce il 3D).
 * Monocromatiche solo X, cerca, chevron, indietro, «centra» (SF Symbol).
 */
export const ICONS_3D = {
  agenda: require('../../assets/icons/fluent-spiral-cal.png'),
  calendar: require('../../assets/icons/fluent-calendar.png'),
  people: require('../../assets/icons/fluent-people.png'),
  profile: require('../../assets/icons/fluent-id-card.png'),
  exam: require('../../assets/icons/fluent-graduate.png'),
  clock: require('../../assets/icons/fluent-clock.png'),
  headquarters: require('../../assets/icons/fluent-building.png'),
  check: require('../../assets/icons/fluent-check.png'),
  memo: require('../../assets/icons/fluent-memo.png'),
  road: ROAD_ASSETS.road,
} satisfies Record<string, ImageSourcePropType>;

export type Icon3DName = keyof typeof ICONS_3D;
