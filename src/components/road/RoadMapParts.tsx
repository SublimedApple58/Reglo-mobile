import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import { carTopArt, markerArt } from '../../road/markerArt';
import { sentimentColor, type Sentiment } from './RoadSentiment';

/**
 * REG-638 Reglo Road — pezzi di mappa condivisi (Road dal vivo, riepilogo,
 * dettaglio guida allievo). Stile dell'anteprima: percorso nero #111 con
 * bordo bianco, segnalazioni = puntino nero + etichetta bianca col simbolo 3D.
 */

type LatLng = { latitude: number; longitude: number };

/** Android rasterizza le view dei marker: si ridisegnano solo finché caricano. */
function useTracksViewChanges(deps: unknown[] = []) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return Platform.OS === 'android' ? tracks : undefined;
}

export const RoadTrack = React.memo(function RoadTrack({ coordinates, width = 7 }: { coordinates: LatLng[]; width?: number }) {
  if (coordinates.length < 2) return null;
  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor="#FFFFFF"
        strokeWidth={width + 5}
        lineCap="round"
        lineJoin="round"
        zIndex={1}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor="#111111"
        strokeWidth={width}
        lineCap="round"
        lineJoin="round"
        zIndex={2}
      />
    </>
  );
});

// Geometria del pin (come il prototipo): etichetta, 7 pt d'aria, puntino 18.
const TAG_H = 36;
const TAG_H_SMALL = 30;
const GAP = 7;
const DOT = 18;
const STOP_DOT = 24;
/** REG-723: la segnalazione piccola (disco tondo). */
const DISC = 30;
/** Quanto la punta del fumetto scende sotto il fumetto (`pin.tail`). */
const TAIL_TIP = 6;

/** Memo: in guida la mappa si ridisegna a ogni fix GPS, i pin no. */
export const RoadMarkerPin = React.memo(function RoadMarkerPin({
  coordinate,
  kind,
  label,
  small = false,
  zIndex,
  sentiment,
  onPress,
  dot = true,
  hidden = false,
}: {
  coordinate: LatLng;
  kind: string;
  label: string;
  small?: boolean;
  zIndex?: number;
  /** Bordo verde/rosso: fatto bene / da migliorare. */
  sentiment?: Sentiment | null;
  /** Tocco sul pin (punti critici, REG-646). */
  onPress?: () => void;
  /**
   * Puntino sotto il fumetto (default). Senza (punti critici): un solo
   * segnaposto, la punta del fumetto sta sul punto.
   */
  dot?: boolean;
  /** Posto fisso vuoto (REG-652): resta montato ma non si vede. */
  hidden?: boolean;
}) {
  const tracksViewChanges = useTracksViewChanges([kind, label, small, sentiment ?? '', dot]);
  // REG-723: la segnalazione piccola è un disco tondo sul punto (come i luoghi
  // di Apple Mappe), non più il fumetto bianco con punta e puntino che copriva
  // la strada. Toccata, si ingrandisce sopra la mappa (`RoadPinBody`).
  if (small) {
    return (
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        zIndex={zIndex ?? 3}
        opacity={hidden ? 0 : 1}
        onPress={hidden ? undefined : onPress}
      >
        <View style={pin.discWrap} pointerEvents="none">
          <View style={[pin.disc, sentiment ? { borderColor: sentimentColor(sentiment) } : null]}>
            <Image source={markerArt(kind)} style={pin.discImg} resizeMode="contain" />
          </View>
        </View>
      </Marker>
    );
  }
  const tagH = TAG_H;
  // Senza puntino: il fumetto e la sua punta (quadrato ruotato, ~6 pt sotto il fumetto).
  const height = dot ? tagH + GAP + DOT : tagH + TAIL_TIP + 1;
  const pointY = dot ? height - DOT / 2 : tagH + TAIL_TIP;
  const anchorY = pointY / height;
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: anchorY }}
      centerOffset={{ x: 0, y: -(pointY - height / 2) }}
      tracksViewChanges={tracksViewChanges}
      zIndex={zIndex ?? (small ? 3 : 5)}
      opacity={hidden ? 0 : 1}
      onPress={hidden ? undefined : onPress}
    >
      <View style={[pin.wrap, { height }]} pointerEvents="none">
        <View
          style={[
            pin.tag,
            sentiment ? { borderWidth: 2.5, borderColor: sentimentColor(sentiment) } : null,
          ]}
        >
          <Image source={markerArt(kind)} style={pin.img} resizeMode="contain" />
          <Text style={pin.label} numberOfLines={1}>{label}</Text>
          <View style={pin.tail} />
        </View>
        {dot ? <View style={pin.dot} /> : null}
      </View>
    </Marker>
  );
}, (a, b) =>
  a.coordinate.latitude === b.coordinate.latitude &&
  a.coordinate.longitude === b.coordinate.longitude &&
  a.kind === b.kind &&
  a.label === b.label &&
  a.small === b.small &&
  a.zIndex === b.zIndex &&
  a.sentiment === b.sentiment &&
  a.onPress === b.onPress &&
  a.dot === b.dot,
);

/**
 * REG-715 — il segnaposto grande (fumetto con etichetta + puntino) come vista
 * normale, FUORI dalla mappa: la segnalazione scelta si disegna sopra la
 * MapView invece di cambiare i props di un Marker montato (su iOS, New
 * Architecture, `AIRMap insertReactSubview` andava fuori indice e i segnaposti
 * sparivano o l'app si chiudeva). Il punto sulla coordinata è a `ROAD_PIN_POINT_Y`.
 */
export const ROAD_PIN_POINT_Y = TAG_H + GAP + DOT / 2;
/** Altezza del segnaposto grande (il punto è a metà del puntino in fondo). */
export const ROAD_PIN_BODY_H = TAG_H + GAP + DOT;
export function RoadPinBody({ kind, label, sentiment }: { kind: string; label: string; sentiment?: Sentiment | null }) {
  return (
    <View style={[pin.wrap, { height: TAG_H + GAP + DOT }]} pointerEvents="none">
      <View style={[pin.tag, sentiment ? { borderWidth: 2.5, borderColor: sentimentColor(sentiment) } : null]}>
        <Image source={markerArt(kind)} style={pin.img} resizeMode="contain" />
        <Text style={pin.label} numberOfLines={1}>{label}</Text>
        <View style={pin.tail} />
      </View>
      <View style={pin.dot} />
    </View>
  );
}

/**
 * REG-723 — i capi del percorso: partenza = cerchio bianco con il centro nero,
 * arrivo = bandierina a scacchi in un disco. `opacity` 0 = posto fisso vuoto.
 */
export function RoadEndpointDot({
  coordinate,
  kind = 'start',
  opacity = 1,
}: {
  coordinate: LatLng;
  kind?: 'start' | 'end';
  opacity?: number;
}) {
  const tracksViewChanges = useTracksViewChanges([kind]);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracksViewChanges} zIndex={4} opacity={opacity}>
      {kind === 'start' ? (
        <View style={pin.start} pointerEvents="none">
          <View style={pin.startCore} />
        </View>
      ) : (
        <View style={pin.end} pointerEvents="none">
          <View style={pin.checker}>
            {CHECKER.map((on, i) => (
              <View key={i} style={[pin.cell, on ? pin.cellInk : null]} />
            ))}
          </View>
        </View>
      )}
    </Marker>
  );
}

/** 3×3 a scacchi (angoli neri). */
const CHECKER = [1, 0, 1, 0, 1, 0, 1, 0, 1].map(Boolean);

// ─── REG-723: il verso di marcia lungo la linea ─────────────────────────────

type Arrow = { at: LatLng; bearing: number };

/**
 * Punti (con la direzione) ogni `spacingM` metri lungo il percorso, dopo
 * `skipM` dalla partenza e prima di `skipM` dall'arrivo.
 */
export function arrowsAlong(coords: LatLng[], spacingM: number, skipM = spacingM / 2): Arrow[] {
  const out: Arrow[] = [];
  if (coords.length < 2) return out;
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const seg = (a: LatLng, b: LatLng) => {
    const x = (b.longitude - a.longitude) * rad * Math.cos(((a.latitude + b.latitude) / 2) * rad);
    const y = (b.latitude - a.latitude) * rad;
    return { len: Math.hypot(x, y) * R, bearing: (Math.atan2(x, y) / rad + 360) % 360 };
  };
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += seg(coords[i - 1], coords[i]).len;
  let next = skipM;
  let walked = 0;
  for (let i = 1; i < coords.length && next <= total - skipM; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const { len, bearing } = seg(a, b);
    while (len > 0 && next <= walked + len && next <= total - skipM) {
      const f = (next - walked) / len;
      out.push({ at: { latitude: a.latitude + (b.latitude - a.latitude) * f, longitude: a.longitude + (b.longitude - a.longitude) * f }, bearing });
      next += spacingM;
    }
    walked += len;
  }
  return out;
}

/** Freccia «›» come linea sulla mappa (gira con la mappa, niente ridisegni): punta in avanti. */
export function chevronCoords(a: Arrow, halfM: number, backM: number): LatLng[] {
  const rad = Math.PI / 180;
  const mLat = 1 / 111_320;
  const mLng = 1 / (111_320 * Math.cos(a.at.latitude * rad));
  const off = (fwd: number, side: number) => {
    const b = a.bearing * rad;
    // avanti = (sin b, cos b) in (est, nord); di lato = (cos b, -sin b)
    const e = fwd * Math.sin(b) + side * Math.cos(b);
    const n = fwd * Math.cos(b) - side * Math.sin(b);
    return { latitude: a.at.latitude + n * mLat, longitude: a.at.longitude + e * mLng };
  };
  return [off(-backM / 2, -halfM), off(backM / 2, 0), off(-backM / 2, halfM)];
}

/**
 * REG-665 — sosta di almeno 5 minuti sul percorso. Miniatura: un punto nero
 * bordato di bianco (come i capi del percorso ma pieno). Mappa grande
 * (`labeled`): sopra il punto la capsula «Sosta 7 min».
 */
export function RoadStopMarker({ coordinate, minutes, labeled }: { coordinate: LatLng; minutes: number; labeled?: boolean }) {
  const tracksViewChanges = useTracksViewChanges([minutes, labeled ? 1 : 0]);
  if (!labeled) {
    return (
      <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracksViewChanges} zIndex={3}>
        <StopGlyph />
      </Marker>
    );
  }
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 - STOP_DOT / 2 / (TAG_H_SMALL + GAP + STOP_DOT) }}
      tracksViewChanges={tracksViewChanges}
      zIndex={3}
    >
      <View style={pin.wrap} pointerEvents="none">
        <View style={[pin.tag, pin.stopTag]}>
          <Text style={pin.label}>Sosta {minutes} min</Text>
          <View style={pin.tail} />
        </View>
        <StopGlyph style={{ marginTop: GAP }} />
      </View>
    </Marker>
  );
}

/** Il segno della sosta: cerchio nero con la «pausa» bianca (≠ dal punto delle segnalazioni). */
function StopGlyph({ style }: { style?: object }) {
  return (
    <View style={[pin.stop, style]} pointerEvents="none">
      <View style={pin.stopBar} />
      <View style={pin.stopBar} />
    </View>
  );
}

/**
 * Auto vista dall'alto, ruotata nella direzione di marcia. `rotation` è già
 * relativa alla camera (Apple Maps non ruota i marker da sé).
 */
export function RoadCarMarker({
  coordinate,
  rotation,
  color,
}: {
  coordinate: LatLng;
  rotation: number;
  /** `carColor` della guida: auto nel colore del veicolo. */
  color?: string | null;
}) {
  const tracksViewChanges = useTracksViewChanges([Math.round(rotation / 5), color ?? '']);
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={10}
    >
      {/* Ombra dell'auto sulla sua sagoma (PNG): resta `shadow*`, ma il layer
          si rasterizza, così mentre la camera si muove non si ricalcola. */}
      <View style={car.wrap} pointerEvents="none" shouldRasterizeIOS>
        <View style={car.haloOuter} />
        <View style={car.haloInner} />
        <Image
          source={carTopArt(color)}
          style={[car.img, { transform: [{ rotate: `${rotation}deg` }] }]}
          resizeMode="contain"
        />
      </View>
    </Marker>
  );
}

const pin = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 6 },
  tag: {
    height: TAG_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 5,
    paddingRight: 13,
    borderRadius: TAG_H / 2,
    backgroundColor: '#FFFFFF',
    // `boxShadow` (clay §0.3): le `shadow*` sui marker si ricalcolano fuori
    // schermo a ogni movimento della mappa.
    boxShadow: '0px 6px 10px rgba(0,0,0,0.16)',
  },
  img: { width: 28, height: 28 },
  // Posto per l'ombra attorno al disco (il marker si ritaglia sulla sua vista).
  discWrap: { padding: 4 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 5px rgba(0,0,0,0.22)',
  },
  discImg: { width: 20, height: 20 },
  label: { fontSize: 13.5, fontWeight: '600', color: '#111111', letterSpacing: -0.1 },
  tail: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -5,
    width: 10,
    height: 10,
    backgroundColor: '#FFFFFF',
    borderBottomRightRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  dot: {
    marginTop: GAP,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: '#111111',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    boxShadow: '0px 2px 3px rgba(0,0,0,0.25)',
  },
  stop: {
    width: STOP_DOT,
    height: STOP_DOT,
    borderRadius: STOP_DOT / 2,
    backgroundColor: '#111111',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.3)',
  },
  stopBar: { width: 3, height: 9, borderRadius: 1, backgroundColor: '#FFFFFF' },
  stopTag: { height: TAG_H_SMALL, borderRadius: TAG_H_SMALL / 2, paddingLeft: 12, paddingRight: 12 },
  start: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.3)',
  },
  startCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111111' },
  end: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.3)',
  },
  checker: { width: 12, height: 12, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: 4, height: 4 },
  cellInk: { backgroundColor: '#111111' },
});

const car = StyleSheet.create({
  wrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  haloOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(17,17,17,0.05)',
  },
  haloInner: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(17,17,17,0.07)',
  },
  img: {
    width: 30,
    height: 46,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
  },
});

/**
 * Alone rosso sotto il punto (più errori = più grande e più intenso), sfumato
 * senza bordi netti (Tiziano 30/10, REG-661).
 * Marker con una vista e non `Circle`: con questa versione di
 * react-native-maps sulla New Architecture il cerchio non si disegnava.
 */
/** Anelli sovrapposti dell'alone: sommati fanno una sfumatura radiale morbida. */
const HALO_RINGS = 24;

export const HeatHalo = React.memo(function HeatHalo({ lat, lng, k, hidden = false }: { lat: number; lng: number; k: number; hidden?: boolean }) {
  const [laid, setLaid] = useState(false);
  const coordinate = useMemo(() => ({ latitude: lat, longitude: lng }), [lat, lng]);
  const size = Math.round(84 + 64 * k);
  // Ogni anello è tenue (bordo quasi invisibile); al centro si sommano tutti.
  // REG-666: più leggeri (QA 30/10: «aloni troppo pesanti»), il simbolo conta di più.
  const alpha = (0.009 + 0.011 * k).toFixed(3);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={!laid} zIndex={1} opacity={hidden ? 0 : 1}>
      <View pointerEvents="none" onLayout={() => setLaid(true)} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {Array.from({ length: HALO_RINGS }, (_, i) => {
          const d = Math.round(size * (1 - i / HALO_RINGS));
          return (
            <View
              key={i}
              style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, backgroundColor: `rgba(220,38,38,${alpha})` }}
            />
          );
        })}
      </View>
    </Marker>
  );
});


/**
 * REG-666 — segnaposto di un punto critico: disco bianco in rilievo con il
 * simbolo 3D dell'errore (niente fumetto rosso). Scelto: disco più grande con
 * l'anello nero e sopra l'etichetta «Pedoni 43». Posto fisso vuoto = `hidden`.
 */
export const HotspotPin = React.memo(function HotspotPin({
  coordinate,
  kind,
  name,
  errors,
  selected = false,
  size = 44,
  hidden = false,
  onPress,
}: {
  coordinate: LatLng;
  kind: string;
  /** Nome breve dell'errore («Pedoni»), solo nell'etichetta del punto scelto. */
  name: string;
  errors: number;
  selected?: boolean;
  size?: number;
  hidden?: boolean;
  onPress?: () => void;
}) {
  const tracksViewChanges = useTracksViewChanges([kind, name, errors, selected ? 1 : 0, size]);
  const d = selected ? Math.round(size * 1.22) : size;
  const tagH = selected ? HP_TAG_H + HP_TAG_GAP : 0;
  // Il centro del disco sta sul punto.
  const height = tagH + d + 6;
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: (tagH + d / 2 + 3) / height }}
      centerOffset={{ x: 0, y: -(tagH + d / 2 + 3 - height / 2) }}
      tracksViewChanges={tracksViewChanges}
      zIndex={selected ? 9 : 4}
      opacity={hidden ? 0 : 1}
      onPress={hidden ? undefined : onPress}
    >
      <View style={[hp.wrap, { height }]} pointerEvents="none">
        {selected ? (
          <View style={hp.tag}>
            <Text style={hp.tagTx} numberOfLines={1}>
              {name}
              <Text style={hp.tagNum}>  {errors}</Text>
            </Text>
          </View>
        ) : null}
        <View style={[hp.disc, { width: d, height: d, borderRadius: d / 2 }, selected && hp.discSel]}>
          <Image source={markerArt(kind)} style={{ width: d * 0.68, height: d * 0.68 }} resizeMode="contain" />
        </View>
      </View>
    </Marker>
  );
});

const HP_TAG_H = 30;
const HP_TAG_GAP = 6;

const hp = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3, paddingHorizontal: 8 },
  disc: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.10), 0px 5px 12px rgba(0,0,0,0.18)',
  },
  discSel: { borderWidth: 3, borderColor: '#111111' },
  tag: {
    height: HP_TAG_H,
    marginBottom: HP_TAG_GAP,
    paddingHorizontal: 12,
    borderRadius: HP_TAG_H / 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.08), 0px 6px 14px rgba(0,0,0,0.16)',
  },
  tagTx: { fontSize: 14, fontWeight: '600', color: '#111111', letterSpacing: -0.1 },
  tagNum: { fontWeight: '500', color: '#6A6A6A' },
});
