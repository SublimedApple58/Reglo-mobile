import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Polyline } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { ROAD_EXIT, ROAD_LAYOUT, roadStagger } from '../../road/motion';

import type { RoadBriefing } from '../../types/regloApi';
import { markerArt } from '../../road/markerArt';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { Icon3D } from '../clay/Icon3D';
import { SENTIMENT_BAD, SENTIMENT_GOOD } from './RoadSentiment';

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

/** Miniatura del percorso: polilinea nera su fondo mappa, niente MapView. */
export function RouteThumb({ thumb, size = 56 }: { thumb: Array<[number, number]>; size?: number }) {
  const pad = 8;
  let pts = '';
  let end: { x: number; y: number } | null = null;
  if (thumb.length >= 2) {
    const lats = thumb.map((p) => p[0]);
    const lngs = thumb.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
    const w = Math.max((maxLng - minLng) * k, 1e-9);
    const h = Math.max(maxLat - minLat, 1e-9);
    const scale = (size - pad * 2) / Math.max(w, h);
    const ox = (size - w * scale) / 2;
    const oy = (size - h * scale) / 2;
    const xy = thumb.map(([lat, lng]) => ({ x: ox + (lng - minLng) * k * scale, y: oy + (maxLat - lat) * scale }));
    pts = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    end = xy[xy.length - 1];
  }
  return (
    <View style={[s.thumb, CLAY_SHADOW.sink, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {pts ? (
          <Polyline points={pts} fill="none" stroke="#111111" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {end ? <Circle cx={end.x} cy={end.y} r={3.2} fill="#111111" /> : null}
      </Svg>
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
  // Miniatura incavata sul bianco (niente fondo crema).
  thumb: { borderRadius: 16, backgroundColor: CLAY.surface, overflow: 'hidden' },
});
