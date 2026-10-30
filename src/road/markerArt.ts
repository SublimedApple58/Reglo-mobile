import type { ImageSourcePropType } from 'react-native';

/**
 * REG-638 Reglo Road — simboli 3D delle segnalazioni.
 *
 * Le chiavi base sono contratto col backend (`ROAD_BASE_MARKERS` in
 * reglo/lib/autoscuole/road/catalog.ts); le voci dell'autoscuola arrivano come
 * `custom:<id>` e usano la stessa icona di «altro» (puntina nera).
 * Icone 3D generate con l'AI in stile unico (REG-639, design-system §0.4),
 * PNG @1x/@2x/@3x a 48 pt. MAI `tintColor` (le appiattisce in una sagoma).
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

const CUSTOM_ART: ImageSourcePropType = ART.altro;

/** Emblema Road (card Road in agenda). */
export const ROAD_ASSETS = {
  road: require('../../assets/web/nav/road-3d.png') as ImageSourcePropType,
};

/**
 * Auto 3D nel colore del veicolo della guida: gli STESSI PNG della web app
 * (`assets/web/road/cars/`, REG-672), chiavi =
 * `carColor` del backend (reglo/lib/autoscuole/road/car-colors.ts). Il server
 * risolve già veicolo → tinta istruttore → bianco; qui solo il fallback.
 */
export const CAR_COLOR_KEYS = ['bianco', 'argento', 'grigio', 'nero', 'rosso', 'arancio', 'giallo', 'verde', 'azzurro', 'blu'] as const;
export type CarColorKey = (typeof CAR_COLOR_KEYS)[number];

const CAR_TOP: Record<CarColorKey, ImageSourcePropType> = {
  bianco: require('../../assets/web/road/cars/auto-su-bianco.png'),
  argento: require('../../assets/web/road/cars/auto-su-argento.png'),
  grigio: require('../../assets/web/road/cars/auto-su-grigio.png'),
  nero: require('../../assets/web/road/cars/auto-su-nero.png'),
  rosso: require('../../assets/web/road/cars/auto-su-rosso.png'),
  arancio: require('../../assets/web/road/cars/auto-su-arancio.png'),
  giallo: require('../../assets/web/road/cars/auto-su-giallo.png'),
  verde: require('../../assets/web/road/cars/auto-su-verde.png'),
  azzurro: require('../../assets/web/road/cars/auto-su-azzurro.png'),
  blu: require('../../assets/web/road/cars/auto-su-blu.png'),
};

const CAR_34: Record<CarColorKey, ImageSourcePropType> = {
  bianco: require('../../assets/web/road/cars/auto-34-bianco.png'),
  argento: require('../../assets/web/road/cars/auto-34-argento.png'),
  grigio: require('../../assets/web/road/cars/auto-34-grigio.png'),
  nero: require('../../assets/web/road/cars/auto-34-nero.png'),
  rosso: require('../../assets/web/road/cars/auto-34-rosso.png'),
  arancio: require('../../assets/web/road/cars/auto-34-arancio.png'),
  giallo: require('../../assets/web/road/cars/auto-34-giallo.png'),
  verde: require('../../assets/web/road/cars/auto-34-verde.png'),
  azzurro: require('../../assets/web/road/cars/auto-34-azzurro.png'),
  blu: require('../../assets/web/road/cars/auto-34-blu.png'),
};

/**
 * Auto di 3/4 GRANDE (≥ 120 pt: card «Guida» del «+», riepilogo prenotazione):
 * il PNG del web è 200 px e lì si sgranerebbe, quindi resta il set mobile
 * (REG-672, scelta di Tiziano 30/10).
 */
const CAR_34_HERO: Record<CarColorKey, ImageSourcePropType> = {
  bianco: require('../../assets/road/cars/auto-34-bianco.png'),
  argento: require('../../assets/road/cars/auto-34-argento.png'),
  grigio: require('../../assets/road/cars/auto-34-grigio.png'),
  nero: require('../../assets/road/cars/auto-34-nero.png'),
  rosso: require('../../assets/road/cars/auto-34-rosso.png'),
  arancio: require('../../assets/road/cars/auto-34-arancio.png'),
  giallo: require('../../assets/road/cars/auto-34-giallo.png'),
  verde: require('../../assets/road/cars/auto-34-verde.png'),
  azzurro: require('../../assets/road/cars/auto-34-azzurro.png'),
  blu: require('../../assets/road/cars/auto-34-blu.png'),
};

const carKey = (color: string | null | undefined): CarColorKey =>
  color && (CAR_COLOR_KEYS as readonly string[]).includes(color) ? (color as CarColorKey) : 'bianco';

/** Auto vista dall'alto (mappa Road). */
export const carTopArt = (color?: string | null) => CAR_TOP[carKey(color)];
/** Auto di 3/4 (invito, card). */
export const car34Art = (color?: string | null) => CAR_34[carKey(color)];
/** Auto di 3/4 grande (card «Guida», riepilogo): set mobile ad alta risoluzione. */
export const car34HeroArt = (color?: string | null) => CAR_34_HERO[carKey(color)];

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
