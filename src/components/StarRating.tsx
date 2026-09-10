import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

  return (
    <View style={styles.container}>
      {stars.map((star) => {
        const filled = star <= currentValue;
        const icon = filled ? 'star' : 'star-outline';
        const color = filled ? filledColor : emptyColor;

        if (readOnly || !onChange) {
          return (
            <View key={star} style={{ padding: 2 }}>
              <Ionicons name={icon} size={size} color={color} />
            </View>
          );
        }

        return (
          <Pressable
            key={star}
            onPress={() => onChange(star === currentValue ? 0 : star)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={({ pressed }) => [
              styles.touchTarget,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={icon} size={size} color={color} />
          </Pressable>
        );
      })}
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
  pressed: {
    opacity: 0.7,
  },
});
