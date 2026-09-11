import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ImpactFeedbackStyle, impactAsync } from '../utils/haptics';

type StarRatingProps = {
  value: number | null;
  onChange?: (rating: number) => void;
  size?: number;
  readOnly?: boolean;
  /**
   * Quante stelline mostrare. Default 5 (valutazione complessiva della guida).
   * Le voci del pagellino usano la scala scelta dall'autoscuola (3 o 5).
   */
  total?: number;
  /**
   * Colore delle stelline piene. Il default resta navy (design system mono-navy).
   * "gold" è usato SOLO dal pagellino (REG-443): scelta esplicita di prodotto
   * per tenerlo identico al web, dove le stelline sono gialle.
   */
  tone?: 'navy' | 'gold';
};

// Brand palette monocromatica navy: resta il default ovunque. UNICA eccezione,
// voluta, il pagellino di valutazione (REG-443), che deve essere identico al
// web — vedi docs/features/evaluation-sheet.md.
const STAR_COLOR = '#1A1A2E';
const STAR_EMPTY_COLOR = '#D7DBE2';
const STAR_COLOR_GOLD = '#FACC15';
const STAR_EMPTY_COLOR_GOLD = '#E7E7EC';

/** Ritardo fra una stella e l'altra quando il voto si accende "a cascata".
 *  12ms: si legge come una cascata, non come un'attesa — su 5 stelle l'ultima
 *  parte dopo 48ms invece di 104. */
const CASCADE_MS = 12;

type StarProps = {
  index: number;
  filled: boolean;
  size: number;
  filledColor: string;
  emptyColor: string;
  onPress?: () => void;
};

/**
 * Una stella. Il pieno è un secondo glifo sovrapposto a quello vuoto: si accende
 * in opacità + scala invece di cambiare colore di colpo, e la riga si riempie
 * a cascata da sinistra, così il voto si "vede scorrere" invece di apparire.
 */
const Star = ({ index, filled, size, filledColor, emptyColor, onPress }: StarProps) => {
  const scale = useSharedValue(1);
  const fill = useSharedValue(filled ? 1 : 0);
  const wasFilled = useRef(filled);

  useEffect(() => {
    if (filled === wasFilled.current) return;
    wasFilled.current = filled;
    if (filled) {
      const delay = index * CASCADE_MS;
      fill.value = withDelay(delay, withTiming(1, { duration: 110 }));
      // Scatto con overshoot: sale oltre il 100% e rientra di molla.
      scale.value = withDelay(
        delay,
        withSequence(
          withTiming(1.3, { duration: 90, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 8, stiffness: 300, mass: 0.5 }),
        ),
      );
    } else {
      // Spegnersi è un gesto minore: niente molla, solo una dissolvenza.
      fill.value = withTiming(0, { duration: 140 });
      scale.value = withTiming(1, { duration: 140 });
    }
  }, [filled, index, fill, scale]);

  const wrapStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.8 + fill.value * 0.2 }],
  }));

  const glyph = (
    <Animated.View style={wrapStyle}>
      <Ionicons name="star-outline" size={size} color={emptyColor} />
      <Animated.View style={[styles.fillLayer, fillStyle]}>
        <Ionicons name="star" size={size} color={filledColor} />
      </Animated.View>
    </Animated.View>
  );

  if (!onPress) return <View style={styles.staticTarget}>{glyph}</View>;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.86, { duration: 90, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 300, mass: 0.6 });
      }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={styles.touchTarget}
    >
      {glyph}
    </Pressable>
  );
};

export const StarRating = ({
  value,
  onChange,
  size = 24,
  readOnly = false,
  total = 5,
  tone = 'navy',
}: StarRatingProps) => {
  const filledColor = tone === 'gold' ? STAR_COLOR_GOLD : STAR_COLOR;
  const emptyColor = tone === 'gold' ? STAR_EMPTY_COLOR_GOLD : STAR_EMPTY_COLOR;
  const stars = Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);
  const currentValue = value ?? 0;
  const interactive = !readOnly && !!onChange;

  const handlePress = useCallback(
    (star: number) => {
      // Stesso tocco del resto dell'app (impactAsync Light sulle azioni):
      // il voto si sente, non solo si vede.
      void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
      onChange?.(star === currentValue ? 0 : star);
    },
    [currentValue, onChange],
  );

  return (
    <View style={styles.container}>
      {stars.map((star) => (
        <Star
          key={star}
          index={star - 1}
          filled={star <= currentValue}
          size={size}
          filledColor={filledColor}
          emptyColor={emptyColor}
          onPress={interactive ? () => handlePress(star) : undefined}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  touchTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticTarget: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
