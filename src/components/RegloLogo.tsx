import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Reglo brand mark — the real logo (vector, straight from Figma): ivory orbit
 * ring + navigation arrow, with a cyan satellite dot resting in the ring gap.
 * Transparent background, so it sits on any surface.
 *
 * When `animated` is on (loader), the ARROW stays fixed while the ring + dot
 * rotate together around the ring's true centre. The rotation is done with a
 * native RN transform (reliable) on an overlay layer — NOT an animated SVG group
 * (which silently fails to animate on some svg+reanimated combos). The pivot is
 * corrected to the ring centre (603.9, 603.9 in the 1254 viewBox), ~23px up-left
 * of the geometric centre, so the ring spins in place instead of wobbling.
 */
const VIEWBOX = 1254;
const RING_CX = 603.9;
const RING_CY = 603.9;
const CYAN = '#55DDE8';

const RING_D =
  'M813.737 455.471C777.871 404.781 724.865 368.79 664.519 354.153C604.173 339.517 540.568 347.224 485.464 375.85C430.36 404.476 387.484 452.085 364.763 509.874C342.042 567.664 341.013 631.726 361.865 690.215C382.718 748.705 424.042 797.667 478.197 828.049C532.353 858.431 595.677 868.178 656.462 855.488C717.248 842.798 771.383 808.529 808.859 759.017C846.335 709.505 864.618 648.099 860.326 586.152';
const ARROW_D =
  'M702.891 494.216C721.558 485.467 740.943 504.165 733.285 523.343L627.983 748.924C619.607 767.862 591.726 763.547 589.213 742.811L576.768 667.058C575.213 658.188 568.272 651.236 559.417 649.798L482.475 637.931C461.894 634.695 458.424 606.767 477.809 598.976L702.891 494.216Z';

const RingGradient = ({ id }: { id: string }) => (
  <LinearGradient id={id} x1="326.925" y1="429.035" x2="932.491" y2="755.12" gradientUnits="userSpaceOnUse">
    <Stop offset="0" stopColor="#FFF7EA" />
    <Stop offset="0.45" stopColor="#FFFAF2" />
    <Stop offset="1" stopColor="#FFF1DF" />
  </LinearGradient>
);
const ArrowGradient = ({ id }: { id: string }) => (
  <LinearGradient id={id} x1="347.737" y1="291.53" x2="886.051" y2="915.116" gradientUnits="userSpaceOnUse">
    <Stop offset="0" stopColor="#FFF7EA" />
    <Stop offset="0.45" stopColor="#FFFAF2" />
    <Stop offset="1" stopColor="#FFF1DF" />
  </LinearGradient>
);

type RegloLogoProps = {
  size?: number;
  animated?: boolean;
};

export const RegloLogo = ({ size = 96, animated = false }: RegloLogoProps) => {
  const rot = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    rot.value = 0;
    rot.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [animated, rot]);

  // Pivot offset (px) from the view centre to the ring centre.
  const off = ((RING_CX - VIEWBOX / 2) * size) / VIEWBOX;

  const ringStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: off },
      { translateY: off },
      { rotate: `${rot.value}deg` },
      { translateX: -off },
      { translateY: -off },
    ],
  }));

  return (
    <View style={{ width: size, height: size }}>
      {/* navigation arrow — fixed */}
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <ArrowGradient id="regloArrow" />
        </Defs>
        <Path d={ARROW_D} fill="url(#regloArrow)" />
      </Svg>

      {/* orbit ring + satellite dot — rotate together around the ring centre */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ringStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Defs>
            <RingGradient id="regloRing" />
          </Defs>
          <Path d={RING_D} stroke="url(#regloRing)" strokeWidth={28} strokeLinecap="round" fill="none" />
          <Circle cx={844} cy={518} r={22} fill={CYAN} />
        </Svg>
      </Animated.View>
    </View>
  );
};
