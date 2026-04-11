import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type StarRatingProps = {
  value: number | null;
  onChange?: (rating: number) => void;
  size?: number;
  readOnly?: boolean;
};

const STAR_COLOR = '#FACC15';
const STAR_EMPTY_COLOR = '#E2E8F0';

export const StarRating = ({ value, onChange, size = 24, readOnly = false }: StarRatingProps) => {
  const stars = [1, 2, 3, 4, 5];
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
