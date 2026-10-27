import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Polyline } from 'react-native-svg';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { ROAD_EXIT, ROAD_LAYOUT, ROAD_SPRING, roadStagger } from '../../road/motion';

import type { RoadBriefing } from '../../types/regloApi';
import { initialsOf } from '../../road/format';
import { avatarColors } from '../../utils/avatarColors';
import { UserPhotoCircle } from '../UserPhotoCircle';
import { SENTIMENT_BAD, SENTIMENT_GOOD } from './RoadSentiment';

/**
 * REG-638 Road «mappa corta» — pezzi condivisi da tab Road e foglio «Parti
 * con»: righe del briefing, miniatura del percorso, volto con le iniziali.
 * Glifi monocromatici (freccia rossa / spunta verde), niente pillole.
 */

type Line = RoadBriefing['lines'][number];

function lineGlyph(tone: Line['tone'], size: number) {
  if (tone === 'bad') return <Ionicons name="arrow-up" size={size} color={SENTIMENT_BAD} />;
  if (tone === 'good') return <Ionicons name="checkmark" size={size} color={SENTIMENT_GOOD} />;
  return <Ionicons name="ellipse-outline" size={size - 6} color="#8E8E93" />;
}

/** Tab: una riga per voce, «Stop · da migliorare 4 volte nelle ultime 5». */
export function BriefingLines({ lines, style }: { lines: Line[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 9 }, style]}>
      {lines.map((l, i) => (
        <Animated.View
          key={`${l.kind}-${l.label}`}
          entering={roadStagger(i)}
          exiting={ROAD_EXIT}
          layout={ROAD_LAYOUT}
          style={s.line}
        >
          <View style={s.lineIc}>{lineGlyph(l.tone, 17)}</View>
          <Text style={s.lineTx} numberOfLines={1}>
            {l.label}
            {l.detail ? <Text style={s.lineDetail}> · {l.detail}</Text> : null}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/** Foglio «Parti con»: glifo nel cerchio, voce e dettaglio su due righe. */
export function BriefingRows({ lines }: { lines: Line[] }) {
  return (
    <View>
      {lines.map((l, i) => (
        <Animated.View
          key={`${l.kind}-${l.label}`}
          entering={roadStagger(i)}
          exiting={ROAD_EXIT}
          layout={ROAD_LAYOUT}
          style={[s.row, i < lines.length - 1 && s.rowSep]}
        >
          <View
            style={[
              s.ring,
              { borderColor: l.tone === 'bad' ? SENTIMENT_BAD : l.tone === 'good' ? SENTIMENT_GOOD : '#C7C7CC' },
            ]}
          >
            {lineGlyph(l.tone, 16)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle} numberOfLines={1}>{l.label}</Text>
            {l.detail ? <Text style={s.rowDetail} numberOfLines={1}>{capitalize(l.detail)}</Text> : null}
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/**
 * Volto dell'allievo in tutto Road: lo stesso della tab Allievi (foto profilo
 * con `UserPhotoCircle`, altrimenti iniziali sul colore ricavato dall'id).
 * `selected` = anello nero che compare morbido, il volto si stringe dentro.
 */
export function RoadAvatar({
  userId,
  name,
  size = 64,
  selected,
}: {
  userId: string | null | undefined;
  name: string;
  size?: number;
  selected?: boolean;
}) {
  const ring = useAnimatedStyle(() => ({
    opacity: withTiming(selected ? 1 : 0, { duration: 180 }),
    transform: [{ scale: withSpring(selected ? 1 : 0.9, ROAD_SPRING) }],
  }));
  const face = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(selected ? (size - 8) / size : 1, ROAD_SPRING) }],
  }));
  const { bg, fg } = avatarColors(userId ?? name);
  return (
    <View style={[s.avatarWrap, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.avatarRing, { borderRadius: size / 2 }, ring]}
      />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }, face]}>
        <UserPhotoCircle userId={userId} size={size}>
          <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
            <Text style={[s.avatarTx, { fontSize: Math.round(size * 0.3), color: fg }]}>{initialsOf(name)}</Text>
          </View>
        </UserPhotoCircle>
      </Animated.View>
    </View>
  );
}

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
    <View style={[s.thumb, { width: size, height: size }]}>
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
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineIc: { width: 20, alignItems: 'center' },
  lineTx: { flex: 1, fontSize: 15.5, fontWeight: '400', color: '#111111', letterSpacing: -0.2 },
  lineDetail: { color: '#3A3A3C' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11 },
  rowSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.18)' },
  ring: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '500', color: '#111111', letterSpacing: -0.2 },
  rowDetail: { fontSize: 13.5, fontWeight: '400', color: '#6A6A6A', marginTop: 1 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderWidth: 2.5, borderColor: '#111111' },
  avatar: { backgroundColor: '#ECECEA', alignItems: 'center', justifyContent: 'center' },
  avatarTx: { fontWeight: '600', color: '#111111', letterSpacing: -0.3 },
  thumb: { borderRadius: 14, backgroundColor: '#F2F0EB', overflow: 'hidden' },
});
