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
 * `ivory` for navy surfaces.
 *
 * Motion (opt-in):
 *  - `spin`: continuous rotation — the loader; reads clearly as "in corso".
 *  - `pulse`: gentle scale + opacity breathing.
 */
const MARKS = {
  ivory: require('../../assets/reglo-mark-ivory.png'),
  navy: require('../../assets/reglo-mark-navy.png'),
} as const;

type RegloLogoProps = {
  size?: number;
  tone?: keyof typeof MARKS;
  spin?: boolean;
  pulse?: boolean;
};

export const RegloLogo = ({ size = 96, tone = 'ivory', spin = false, pulse = false }: RegloLogoProps) => {
  const rot = useSharedValue(0);
  const p = useSharedValue(0);

  useEffect(() => {
    if (!spin) return;
    rot.value = 0;
    rot.value = withRepeat(withTiming(360, { duration: 3200, easing: Easing.linear }), -1, false);
  }, [spin, rot]);

  useEffect(() => {
    if (!pulse) return;
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse, p]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }, { scale: 0.96 + p.value * 0.04 }],
    opacity: 0.85 + p.value * 0.15,
  }));

  return (
    <Animated.View style={spin || pulse ? style : undefined}>
      <Image source={MARKS[tone]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
};
