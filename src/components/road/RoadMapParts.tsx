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
  const tagH = small ? TAG_H_SMALL : TAG_H;
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
            small ? pin.tagSmall : null,
            sentiment ? { borderWidth: 2.5, borderColor: sentimentColor(sentiment) } : null,
          ]}
        >
          <Image source={markerArt(kind)} style={small ? pin.imgSmall : pin.img} resizeMode="contain" />
          {small ? null : <Text style={pin.label} numberOfLines={1}>{label}</Text>}
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

/** Puntino bianco bordato di nero: partenza / arrivo nelle minimappe. */
export function RoadEndpointDot({ coordinate }: { coordinate: LatLng }) {
  const tracksViewChanges = useTracksViewChanges();
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracksViewChanges} zIndex={4}>
      <View style={pin.endpoint} pointerEvents="none" />
    </Marker>
  );
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
  tagSmall: { height: TAG_H_SMALL, borderRadius: TAG_H_SMALL / 2, paddingLeft: 4, paddingRight: 4, gap: 0 },
  img: { width: 28, height: 28 },
  imgSmall: { width: 22, height: 22 },
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
  endpoint: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#111111',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.25)',
  },
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
