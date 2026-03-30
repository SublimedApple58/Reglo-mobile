import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, pink, spacing, typography } from '../theme';

type BookingCelebrationProps = {
  visible: boolean;
  variant?: 'booking' | 'swap';
  onHidden?: () => void;
};

const BURST_POINTS = [
  { angle: -88, distance: 54 },
  { angle: -48, distance: 60 },
  { angle: -14, distance: 62 },
  { angle: 22, distance: 60 },
  { angle: 56, distance: 54 },
];

export const BookingCelebration = ({ visible, variant = 'booking', onHidden }: BookingCelebrationProps) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 1450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHidden?.();
    });
  }, [visible, onHidden, progress]);

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 0.12, 0.88, 1],
    outputRange: [0, 1, 1, 0],
  });

  const cardOpacity = progress.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });
  const cardScale = progress.interpolate({
    inputRange: [0, 0.2, 0.5, 1],
    outputRange: [0.82, 1.08, 1, 0.96],
  });
  const cardTranslateY = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [18, 0, -6],
  });

  const ringScale = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.5, 1.35, 1.5],
  });
  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.4, 0],
  });

  const sparkStyles = useMemo(() => {
    return BURST_POINTS.map((point) => {
      const rad = (point.angle * Math.PI) / 180;
      const x = Math.cos(rad) * point.distance;
      const y = Math.sin(rad) * point.distance;
      return {
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 0.24, 1],
              outputRange: [0, x * 0.65, x],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 0.24, 1],
              outputRange: [0, y * 0.65, y],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.18, 1],
              outputRange: [0.3, 1.05, 0.8],
            }),
          },
        ],
        opacity: progress.interpolate({
          inputRange: [0, 0.12, 0.75, 1],
          outputRange: [0, 1, 0.9, 0],
        }),
      };
    });
  }, [progress]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      <Animated.View style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />

      {sparkStyles.map((sparkStyle, index) => (
        <Animated.View key={`spark-${index}`} style={[styles.sparkWrap, sparkStyle]}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
        </Animated.View>
      ))}

      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
          },
        ]}
      >
        {variant === 'swap' ? (
          <View style={styles.swapIconCircle}>
            <Text style={styles.swapEmoji}>🤝</Text>
          </View>
        ) : (
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={46} color={colors.positive} />
          </View>
        )}
        <Text style={styles.title}>
          {variant === 'swap' ? 'Affare fatto!' : 'Prenotazione confermata'}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 24, 40, 0.16)',
  },
  card: {
    minWidth: 248,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  ring: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 3,
    borderColor: pink[200],
  },
  sparkWrap: {
    position: 'absolute',
  },
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  swapIconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.4)',
  },
  swapEmoji: {
    fontSize: 36,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
