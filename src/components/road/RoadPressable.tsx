import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ROAD_SPRING } from '../../road/motion';

const APressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable con feedback fisico (design-system §8.4): scala a molla, più
 * opacità sulla CTA. `kind`: 'cta' 0.96 · 'card' 0.97 · 'small' 0.92.
 */
export function RoadPressable({
  kind = 'card',
  style,
  children,
  ...rest
}: Omit<PressableProps, 'style'> & { kind?: 'cta' | 'card' | 'small'; style?: StyleProp<ViewStyle> }) {
  const pressed = useSharedValue(0);
  const to = kind === 'cta' ? 0.96 : kind === 'small' ? 0.92 : 0.97;
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? to : 1, ROAD_SPRING) }],
    opacity: kind === 'cta' ? withTiming(pressed.value ? 0.88 : 1, { duration: 100 }) : 1,
  }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        pressed.value = 1;
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = 0;
        rest.onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children as React.ReactNode}
    </APressable>
  );
}
