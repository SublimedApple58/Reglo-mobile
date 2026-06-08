import React, { useEffect } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  stroke?: number;
  /** 0..1 */
  progress: number;
  /** Solid arc color (used when `gradient` is not provided). */
  color?: string;
  /** Diagonal gradient for the arc — [light, dark] gives a 3D sheen. */
  gradient?: readonly [string, string];
  /** Unfilled ring color. */
  trackColor?: string;
  /** Center hole color — match the background behind it so it reads as a ring. */
  innerColor?: string;
  children?: React.ReactNode;
};

/**
 * Circular progress ring built with pure RN Views + Reanimated + a linear
 * gradient (no SVG, so it ships over-the-air). Two clipped half-disks pivot
 * around the center to sweep the filled arc clockwise from the top; rounded caps
 * are raised dots at the arc's start and (rotating) end. A soft drop shadow
 * floats the whole ring for depth. Animates from 0 → progress on mount.
 */
export function ProgressRing({
  size = 130,
  stroke = 12,
  progress,
  color = '#1A1A2E',
  gradient,
  trackColor = '#ECECEC',
  innerColor = '#FDFDFD',
  children,
}: Props) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const a = useSharedValue(0);

  useEffect(() => {
    a.value = 0;
    a.value = withTiming(p, { duration: 1050, easing: Easing.out(Easing.cubic) });
  }, [p]);

  const half = size / 2;
  const innerSize = size - stroke * 2;
  const capLeft = (size - stroke) / 2;
  const capColor = gradient ? gradient[1] : color;

  const rightAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.min(a.value, 0.5) * 360}deg` }],
  }));
  const leftAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.max(a.value - 0.5, 0) * 360}deg` }],
  }));
  const capAnim = useAnimatedStyle(() => ({
    opacity: a.value > 0.001 ? 1 : 0,
    transform: [{ rotate: `${a.value * 360}deg` }],
  }));

  const Fill = ({ side }: { side: 'left' | 'right' }) => {
    const radiusStyle =
      side === 'right'
        ? { borderTopLeftRadius: half, borderBottomLeftRadius: half }
        : { borderTopRightRadius: half, borderBottomRightRadius: half };
    if (gradient) {
      return (
        <LinearGradient
          colors={gradient as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[{ width: half, height: size }, radiusStyle]}
        />
      );
    }
    return <View style={[{ width: half, height: size, backgroundColor: color }, radiusStyle]} />;
  };

  const cap = {
    position: 'absolute' as const,
    width: stroke,
    height: stroke,
    borderRadius: stroke / 2,
    backgroundColor: capColor,
    top: 0,
    left: capLeft,
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Soft drop shadow disk — floats the ring (3D) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          backgroundColor: trackColor,
          shadowColor: '#1A1A2E',
          shadowOpacity: 0.22,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
          elevation: 9,
        }}
      />

      {/* Right clip (container right half) */}
      <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', left: -half, top: 0, width: half, height: size, transformOrigin: 'right center' }, rightAnim]}>
          <Fill side="right" />
        </Animated.View>
      </View>

      {/* Left clip (container left half) */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', left: half, top: 0, width: half, height: size, transformOrigin: 'left center' }, leftAnim]}>
          <Fill side="left" />
        </Animated.View>
      </View>

      {/* Rounded, raised caps */}
      {p > 0 ? (
        <>
          <View style={cap} />
          <Animated.View style={[{ position: 'absolute', width: size, height: size }, capAnim]}>
            <View
              style={[
                cap,
                {
                  shadowColor: '#1A1A2E',
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 4,
                },
              ]}
            />
          </Animated.View>
        </>
      ) : null}

      {/* Center hole → turns the disk into a ring; subtle inset for depth */}
      <View
        style={{
          position: 'absolute',
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: innerColor,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#1A1A2E',
          shadowOpacity: 0.12,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 1 },
        }}
      >
        {children}
      </View>
    </View>
  );
}
