import React, { useEffect } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';

type Props = {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
};

const TRACK_W = 48;
const TRACK_H = 30;
const PAD = 3;
const THUMB = TRACK_H - PAD * 2; // 24
const TRAVEL = TRACK_W - PAD * 2 - THUMB; // 18

/**
 * Sober custom toggle — flat track (light grey → navy), white thumb with a
 * subtle shadow, smooth slide. Replaces the native liquid-glass Switch.
 */
export const ToggleSwitch = ({ value, onValueChange, activeColor = '#1A1A2E', disabled, style }: Props) => {
  const p = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value, p]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], ['#DDDDDD', activeColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * TRAVEL }],
  }));

  return (
    <Pressable
      onPress={() => { if (!disabled) onValueChange(!value); }}
      hitSlop={8}
      style={[disabled && { opacity: 0.5 }, style]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: PAD, justifyContent: 'center' },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 2.5, elevation: 2,
  },
});
