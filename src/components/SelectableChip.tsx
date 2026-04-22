import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

type SelectableChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const ACTIVE_BG = '#FEF9C3';
const ACTIVE_BORDER = '#FDE047';
const INACTIVE_BG = '#F8FAFC';
const INACTIVE_BORDER = '#E2E8F0';

export const SelectableChip = ({
  label,
  active,
  onPress,
  style,
  textStyle,
}: SelectableChipProps) => {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const animatedStyles = useMemo(
    () => ({
      backgroundColor: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [INACTIVE_BG, ACTIVE_BG],
      }),
      borderColor: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [INACTIVE_BORDER, ACTIVE_BORDER],
      }),
    }),
    [progress],
  );

  const animatedTextColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#64748B', '#A16207'],
  });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Animated.View style={[styles.chip, animatedStyles, style]}>
        <Animated.Text style={[styles.text, { color: animatedTextColor }, textStyle]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
