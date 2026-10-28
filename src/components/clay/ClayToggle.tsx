import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CLAY_SHADOW } from '../../theme/clay';
import { SEGMENT_TIMING } from '../../utils/motion';

const W = 50;
const H = 30;
const PAD = 3;
const KNOB = H - PAD * 2;
const TRAVEL = W - PAD * 2 - KNOB;

/**
 * Interruttore clay (§0.5): binario incavato bianco (`sink`) che si riempie di
 * nero quando è acceso (dissolvenza, non cambio di colore di botto), pallino
 * bianco in rilievo che scorre in 200 ms senza rimbalzo.
 */
export function ClayToggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  testID,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, SEGMENT_TIMING);
  }, [value, p]);

  const fill = useAnimatedStyle(() => ({ opacity: p.value }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * TRAVEL }] }));

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync().catch(() => {});
        onValueChange(!value);
      }}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={disabled && s.off}
    >
      <View style={[s.track, CLAY_SHADOW.sink]}>
        <Animated.View style={[StyleSheet.absoluteFill, s.fill, CLAY_SHADOW.ink, fill]} />
        <Animated.View style={[s.knob, CLAY_SHADOW.raiseSm, knob]} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, backgroundColor: '#FFFFFF', padding: PAD, justifyContent: 'center' },
  fill: { borderRadius: H / 2, backgroundColor: '#1E1E1E' },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#FFFFFF' },
  off: { opacity: 0.45 },
});
