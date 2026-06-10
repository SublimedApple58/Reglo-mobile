import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radii } from '../theme';

type SkeletonBlockProps = {
  width?: number | `${number}%` | '100%';
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export const SkeletonBlock = ({
  width = '100%',
  height = 14,
  radius = 10,
  style,
}: SkeletonBlockProps) => {
  const opacity = useRef(new Animated.Value(0.42)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.42,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
};

export const SkeletonRing = ({
  size = 84,
  stroke = 9,
}: {
  size?: number;
  stroke?: number;
}) => {
  const opacity = useRef(new Animated.Value(0.42)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 760, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.42, duration: 760, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        opacity,
      }}
    />
  );
};

export const SkeletonCard = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  block: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  card: {
    borderRadius: radii.lg,
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 10,
  },
});
