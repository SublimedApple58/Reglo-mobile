import React, { useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { FIELD_HEIGHT } from '../../theme/spacing';
import { SOFT_SPRING } from '../../utils/motion';

const PAD = 4;

/**
 * Controllo segmentato clay (§0): binario incavato bianco (`sink`), cursore
 * in clay nero che scivola senza rimbalzo; testo bianco sulla voce scelta.
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
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(idx * segW, SOFT_SPRING);
  }, [idx, segW, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[s.track, CLAY_SHADOW.sink, style]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      testID={testID}
    >
      {segW > 0 ? <Animated.View style={[s.thumb, CLAY_SHADOW.ink, { width: segW }, thumb]} /> : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              if (on) return;
              Haptics.selectionAsync().catch(() => undefined);
              onChange(o.value);
            }}
            style={s.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            testID={o.testID}
          >
            <Text style={[s.tx, on && s.txOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
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
  tx: { fontSize: 15, fontWeight: '500', color: CLAY.ink3, letterSpacing: -0.2 },
  txOn: { color: '#FFFFFF', fontWeight: '600' },
});
