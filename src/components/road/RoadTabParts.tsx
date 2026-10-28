import React, { useMemo } from 'react';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import MapView from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { ROAD_EXIT, ROAD_LAYOUT, roadStagger } from '../../road/motion';

import type { RoadBriefing } from '../../types/regloApi';
import { markerArt } from '../../road/markerArt';
import { CLAY } from '../../theme/clay';
import { Icon3D } from '../clay/Icon3D';
import { SENTIMENT_BAD, SENTIMENT_GOOD } from './RoadSentiment';
import { RoadTrack } from './RoadMapParts';
import { regionFor } from './RoadMiniMap';

/**
 * REG-638 Road «mappa corta» — pezzi condivisi da tab Road e foglio «Parti
 * con»: righe del briefing, miniatura del percorso, volto.
 * Clay v2 (REG-639): ogni voce ha la sua icona 3D colorata (la stessa delle
 * segnalazioni sulla mappa); il segno è un glifo monocromatico in fondo alla
 * riga (freccia rossa = da migliorare, spunta verde = fatta bene). Niente pillole.
 */

type Line = RoadBriefing['lines'][number];

function toneGlyph(tone: Line['tone']) {
  if (tone === 'bad') return <Ionicons name="arrow-up" size={17} color={SENTIMENT_BAD} accessibilityLabel="da migliorare" />;
  if (tone === 'good') return <Ionicons name="checkmark" size={18} color={SENTIMENT_GOOD} accessibilityLabel="fatta bene" />;
  return null;
}

/** Tab: icona 3D, «Stop · 4 volte su 5», glifo in fondo. */
export function BriefingLines({ lines, style }: { lines: Line[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      {lines.map((l, i) => (
        <Animated.View
          key={`${l.kind}-${l.label}`}
          entering={roadStagger(i)}
          exiting={ROAD_EXIT}
          layout={ROAD_LAYOUT}
          style={[s.line, i > 0 && s.sep]}
        >
          <Icon3D source={markerArt(l.kind)} size={30} />
          <Text style={s.lineTx} numberOfLines={1}>
            {l.label}
            {l.detail ? <Text style={s.lineDetail}> · {l.detail}</Text> : null}
          </Text>
          {toneGlyph(l.tone)}
        </Animated.View>
      ))}
    </View>
  );
}

/** Foglio «Parti con»: icona 3D, voce e dettaglio su due righe, glifo in fondo. */
export function BriefingRows({ lines }: { lines: Line[] }) {
  return (
    <View>
      {lines.map((l, i) => (
        <Animated.View
          key={`${l.kind}-${l.label}`}
          entering={roadStagger(i)}
          exiting={ROAD_EXIT}
          layout={ROAD_LAYOUT}
          style={[s.row, i > 0 && s.sep]}
        >
          <Icon3D source={markerArt(l.kind)} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle} numberOfLines={1}>{l.label}</Text>
            {l.detail ? <Text style={s.rowDetail} numberOfLines={1}>{capitalize(l.detail)}</Text> : null}
          </View>
          {toneGlyph(l.tone)}
        </Animated.View>
      ))}
    </View>
  );
}

const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Volto di Road = il volto clay dell'app (REG-639). */
export { Avatar as RoadAvatar } from '../clay/Avatar';

/** Sotto ~50 m di estensione il percorso è «un punto» (es. guide di prova). */
const MIN_SPAN_DEG = 0.0005;

/**
 * Miniatura del percorso: mappa vera (Apple Maps / Google lite), senza gesti.
 * - Percorso: la zona inquadrata sul tracciato nero.
 * - Percorso vuoto o troppo corto: la zona del punto di partenza (o della
 *   sede, se non c'è nessun punto) con un puntino nero al centro.
 * Mai un riquadro bianco vuoto (Tiziano 28/10/2026).
 */
export function RouteThumb({
  thumb,
  size = 56,
  fallback,
}: {
  thumb: Array<[number, number]>;
  size?: number;
  /** Dove centrare se la guida non ha punti (la sede). */
  fallback?: { lat: number; lng: number } | null;
}) {
  const coords = useMemo(() => thumb.map(([lat, lng]) => ({ latitude: lat, longitude: lng })), [thumb]);
  const view = useMemo(() => {
    if (coords.length >= 2) {
      const lats = coords.map((c) => c.latitude);
      const lngs = coords.map((c) => c.longitude);
      const spanLat = Math.max(...lats) - Math.min(...lats);
      const spanLng = Math.max(...lngs) - Math.min(...lngs);
      if (Math.max(spanLat, spanLng) >= MIN_SPAN_DEG) {
        const r = regionFor(coords);
        // Quadrato: lo stesso margine su entrambi gli assi.
        const d = Math.max(r.latitudeDelta, r.longitudeDelta) * 1.1;
        return { region: { ...r, latitudeDelta: d, longitudeDelta: d }, track: true };
      }
    }
    const c = coords[0] ?? (fallback ? { latitude: fallback.lat, longitude: fallback.lng } : null);
    if (!c) return { region: regionFor([]), track: false, dot: false };
    return { region: { ...c, latitudeDelta: 0.006, longitudeDelta: 0.006 }, track: false, dot: true };
  }, [coords, fallback]);

  return (
    <View style={[s.thumb, { width: size, height: size }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, s.thumbClip]}>
        <MapView
          style={StyleSheet.absoluteFill}
          region={view.region}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsCompass={false}
          showsScale={false}
          toolbarEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          liteMode={Platform.OS === 'android'}
          userInterfaceStyle="light"
        >
          {view.track ? <RoadTrack coordinates={coords} width={2.5} /> : null}
        </MapView>
        {/* Puntino al centro (la mappa è centrata sul punto): una View, niente Marker. */}
        {view.dot ? <View style={s.thumbDot} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(17,17,17,0.12)' },
  lineTx: { flex: 1, fontSize: 15.5, fontWeight: '400', color: CLAY.ink, letterSpacing: -0.2 },
  lineDetail: { color: CLAY.ink3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 9 },
  rowTitle: { fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  rowDetail: { fontSize: 13.5, fontWeight: '400', color: CLAY.ink3, marginTop: 1 },
  // Miniatura: il ritaglio sta sul figlio, il bordo sottile sul contenitore.
  thumb: { borderRadius: 16, backgroundColor: '#F2F2F0', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(17,17,17,0.12)' },
  thumbClip: { borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CLAY.ink,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
