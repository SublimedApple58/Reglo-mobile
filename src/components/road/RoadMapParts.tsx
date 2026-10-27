import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import { carTopArt, markerArt } from '../../road/markerArt';

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

export function RoadTrack({ coordinates, width = 7 }: { coordinates: LatLng[]; width?: number }) {
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
}

// Geometria del pin (come il prototipo): etichetta, 7 pt d'aria, puntino 18.
const TAG_H = 36;
const TAG_H_SMALL = 30;
const GAP = 7;
const DOT = 18;

export function RoadMarkerPin({
  coordinate,
  kind,
  label,
  small = false,
  zIndex,
}: {
  coordinate: LatLng;
  kind: string;
  label: string;
  small?: boolean;
  zIndex?: number;
}) {
  const tracksViewChanges = useTracksViewChanges([kind, label, small]);
  const tagH = small ? TAG_H_SMALL : TAG_H;
  const height = tagH + GAP + DOT;
  const anchorY = (height - DOT / 2) / height;
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: anchorY }}
      centerOffset={{ x: 0, y: -(height / 2 - DOT / 2) }}
      tracksViewChanges={tracksViewChanges}
      zIndex={zIndex ?? (small ? 3 : 5)}
    >
      <View style={[pin.wrap, { height }]} pointerEvents="none">
        <View style={[pin.tag, small ? pin.tagSmall : null]}>
          <Image source={markerArt(kind)} style={small ? pin.imgSmall : pin.img} resizeMode="contain" />
          {small ? null : <Text style={pin.label} numberOfLines={1}>{label}</Text>}
          <View style={pin.tail} />
        </View>
        <View style={pin.dot} />
      </View>
    </Marker>
  );
}

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
      <View style={car.wrap} pointerEvents="none">
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
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  endpoint: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#111111',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
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
