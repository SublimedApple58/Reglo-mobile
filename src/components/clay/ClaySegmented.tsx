import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { FIELD_HEIGHT } from '../../theme/spacing';
import { SEGMENT_TIMING } from '../../utils/motion';

const PAD = 4;

/**
 * Controllo segmentato clay (§0): binario incavato bianco (`sink`), cursore
 * in clay nero che scivola senza rimbalzo; testo bianco sulla voce scelta.
 *
 * Reattivo (Tiziano 28/10/2026, «lentissime»): il cursore parte AL TOCCO
 * (`onPressIn`) sul thread UI, prima che il genitore si ri-renderizzi, e
 * arriva in 200 ms (`SEGMENT_TIMING`). Le etichette non cambiano colore di
 * colpo: la versione bianca e quella grigia si incrociano in dissolvenza,
 * guidate dalla posizione del cursore (niente re-render React).
 */
export function ClaySegmented<T extends string | number>({
  options,
  value,
  onChange,
  style,
  testID,
}: {
  options: Array<{ value: T; label: string; testID?: string }>;
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = options.length ? (w - PAD * 2) / options.length : 0;
  // Posizione del cursore in «voci» (0, 1, 2…): non dipende dalla larghezza.
  const pos = useSharedValue(idx);
  const target = useRef(idx);

  // Valore cambiato da fuori (o conferma del nostro tocco): si allinea solo
  // se il cursore non ci sta già andando.
  useEffect(() => {
    if (target.current === idx) return;
    target.current = idx;
    pos.value = withTiming(idx, SEGMENT_TIMING);
  }, [idx, pos]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * segW }] }));

  const select = (i: number) => {
    if (i === target.current) return;
    target.current = i;
    pos.value = withTiming(i, SEGMENT_TIMING);
    Haptics.selectionAsync().catch(() => undefined);
    onChange(options[i].value);
  };

  return (
    <View
      style={[s.track, CLAY_SHADOW.sink, style]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      testID={testID}
    >
      {segW > 0 ? <Animated.View style={[s.thumb, CLAY_SHADOW.ink, { width: segW }, thumb]} /> : null}
      {options.map((o, i) => (
        <Pressable
          key={String(o.value)}
          onPressIn={() => select(i)}
          style={s.item}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === idx }}
          accessibilityLabel={o.label}
          testID={o.testID}
        >
          <SegmentLabel label={o.label} index={i} pos={pos} />
        </Pressable>
      ))}
    </View>
  );
}

/** Etichetta grigia + etichetta bianca sovrapposte, in dissolvenza incrociata. */
function SegmentLabel({ label, index, pos }: { label: string; index: number; pos: SharedValue<number> }) {
  // 1 quando il cursore è sulla voce, 0 da tre quarti di voce in là: la
  // dissolvenza dura ~150 ms dei 200 dello scivolamento.
  const onStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(pos.value - index) / 0.75) }));
  const offStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(pos.value - index) / 0.75) }));
  return (
    <View>
      <Animated.Text style={[s.tx, offStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
      <Animated.Text style={[s.tx, s.txOn, s.overlay, onStyle]} numberOfLines={1} importantForAccessibility="no">
        {label}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    height: FIELD_HEIGHT,
    borderRadius: FIELD_HEIGHT / 2,
    backgroundColor: CLAY.surface,
    flexDirection: 'row',
    padding: PAD,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: (FIELD_HEIGHT - PAD * 2) / 2,
    backgroundColor: CLAY.ink,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tx: { fontSize: 15, fontWeight: '500', color: CLAY.ink3, letterSpacing: -0.2, textAlign: 'center' },
  txOn: { color: '#FFFFFF', fontWeight: '600' },
  overlay: { position: 'absolute', left: -4, right: -4, top: 0 },
});
