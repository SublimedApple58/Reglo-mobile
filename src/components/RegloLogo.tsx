import React, { useEffect } from 'react';
import { Image } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Reglo brand mark — the new hand-drawn sun symbol, rendered from a bundled PNG
 * (transparent bg). `tone` picks the colour: `navy` for light surfaces (login),
 * `ivory` for the navy loader/splash.
 *
 * When `animated` is on (loader) the mark breathes: a gentle scale + opacity
 * pulse, ~2s loop. No rotation — the mark is asymmetric and reads best steady.
 */
const MARKS = {
  ivory: require('../../assets/reglo-mark-ivory.png'),
  navy: require('../../assets/reglo-mark-navy.png'),
} as const;

type RegloLogoProps = {
  size?: number;
  animated?: boolean;
  tone?: keyof typeof MARKS;
};

export const RegloLogo = ({ size = 96, animated = false, tone = 'ivory' }: RegloLogoProps) => {
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
    <Animated.View style={animated ? style : undefined}>
      <Image source={MARKS[tone]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
};
