import type { ImageSourcePropType } from 'react-native';

/**
 * REG-638 Reglo Road — simboli 3D delle segnalazioni.
 *
 * Le chiavi base sono contratto col backend (`ROAD_BASE_MARKERS` in
 * reglo/lib/autoscuole/road/catalog.ts); le voci dell'autoscuola arrivano come
 * `custom:<id>` e usano tutte la puntina (già ricolorata: niente rosa).
 * Immagini 3D: MAI `tintColor` (le appiattisce in una sagoma).
 */
const ART: Record<string, ImageSourcePropType> = {
  stop: require('../../assets/road/s-stop.png'),
  precedenza: require('../../assets/road/s-prec.png'),
  distanza: require('../../assets/road/s-dist.png'),
  velocita: require('../../assets/road/f-vel.png'),
  semaforo: require('../../assets/road/f-sem.png'),
  rotonda: require('../../assets/road/f-rot.png'),
  svolta: require('../../assets/road/f-svo.png'),
  corsia: require('../../assets/road/f-cor.png'),
  pedoni: require('../../assets/road/f-ped.png'),
  specchietti: require('../../assets/road/f-spe.png'),
  parcheggio: require('../../assets/road/f-par.png'),
  altro: require('../../assets/road/f-alt.png'),
};

const CUSTOM_ART: ImageSourcePropType = require('../../assets/road/f-cus.png');

export const ROAD_ASSETS = {
  carTop: require('../../assets/road/auto-su.png') as ImageSourcePropType,
  car34: require('../../assets/road/auto-34.png') as ImageSourcePropType,
  pin: require('../../assets/road/f-loc.png') as ImageSourcePropType,
  stop: ART.stop,
  memo: ART.altro,
  road: require('../../assets/road/fluent-road.png') as ImageSourcePropType,
};

export const CUSTOM_KIND_PREFIX = 'custom:';

export function markerArt(kind: string): ImageSourcePropType {
  return ART[kind] ?? CUSTOM_ART;
}

/**
 * Etichette corte della griglia «Cosa è successo?» (stanno su una riga sotto il
 * riquadro). Nel resto dell'app si usa l'etichetta piena del catalogo/server.
 */
const SHORT_LABELS: Record<string, string> = {
  distanza: 'Distanza',
  corsia: 'Corsia',
};

export function shortMarkerLabel(kind: string, label: string): string {
  return SHORT_LABELS[kind] ?? label;
}

/** Catalogo base di riserva (se `/road/state` non è ancora arrivato). */
export const FALLBACK_BASE_CATALOG = [
  { key: 'stop', label: 'Stop' },
  { key: 'precedenza', label: 'Precedenza' },
  { key: 'distanza', label: 'Distanza di sicurezza' },
  { key: 'velocita', label: 'Velocità' },
  { key: 'semaforo', label: 'Semaforo' },
  { key: 'rotonda', label: 'Rotonda' },
  { key: 'svolta', label: 'Svolta' },
  { key: 'corsia', label: 'Posizione in corsia' },
  { key: 'pedoni', label: 'Pedoni' },
  { key: 'specchietti', label: 'Specchietti' },
  { key: 'parcheggio', label: 'Parcheggio' },
  { key: 'altro', label: 'Altro' },
];
