import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';

type SelectableChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const ACTIVE_COLOR = '#324D7A';
const INACTIVE_BG = 'rgba(255, 255, 255, 0.7)';

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
        outputRange: [INACTIVE_BG, ACTIVE_COLOR],
      }),
      borderColor: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.glassBorder, ACTIVE_COLOR],
      }),
    }),
    [progress],
  );

  const animatedTextColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, '#FFFFFF'],
  });

  return (
    <Pressable onPress={onPress}>
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
  },
  text: {
    ...typography.body,
  },
});
