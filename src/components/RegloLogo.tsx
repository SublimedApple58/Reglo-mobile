import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Reglo brand mark — the new hand-drawn sun symbol, in ivory so it sits on the
 * navy auth/loading surfaces. Rendered from a bundled PNG (transparent bg), so
 * no vector/tint tricks are needed.
 *
 * When `animated` is on (loader) the mark breathes: a gentle scale + opacity
 * pulse, ~2s loop. No rotation — the mark is asymmetric and reads best steady.
 */
const MARK = require('../../assets/reglo-mark-ivory.png');

type RegloLogoProps = {
  size?: number;
  animated?: boolean;
};

export const RegloLogo = ({ size = 96, animated = false }: RegloLogoProps) => {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [animated, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + t.value * 0.06 }],
    opacity: 0.82 + t.value * 0.18,
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, animated && style]}>
      <Image source={MARK} style={StyleSheet.absoluteFill} resizeMode="contain" />
    </Animated.View>
  );
};
