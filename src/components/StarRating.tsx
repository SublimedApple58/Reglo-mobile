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
};

// Brand palette is monochrome navy — no yellow/gold anywhere.
const STAR_COLOR = '#1A1A2E';
const STAR_EMPTY_COLOR = '#D7DBE2';

export const StarRating = ({
  value,
  onChange,
  size = 24,
  readOnly = false,
  total = 5,
}: StarRatingProps) => {
  const stars = Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);
  const currentValue = value ?? 0;

  return (
    <View style={styles.container}>
      {stars.map((star) => {
        const filled = star <= currentValue;
        const icon = filled ? 'star' : 'star-outline';
        const color = filled ? STAR_COLOR : STAR_EMPTY_COLOR;

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
