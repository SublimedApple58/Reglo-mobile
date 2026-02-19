import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type ScrollHintFabProps = {
  direction: 'up' | 'down';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export const ScrollHintFab = ({ direction, onPress, style }: ScrollHintFabProps) => {
  const floatValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.spring(floatValue, {
          toValue: 1,
          speed: 10,
          bounciness: 12,
          useNativeDriver: true,
        }),
        Animated.delay(120),
        Animated.spring(floatValue, {
          toValue: 0,
          speed: 9,
          bounciness: 10,
          useNativeDriver: true,
        }),
        Animated.timing(floatValue, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(260),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [floatValue]);

  const translateY = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, direction === 'up' ? -7 : 7],
  });

  return (
    <Animated.View style={[styles.floatLayer, style, { transform: [{ translateY }] }]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Ionicons
          name="chevron-down"
          size={19}
          color={colors.textSecondary}
          style={direction === 'up' ? styles.iconMirror : null}
        />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatLayer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 4,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.35,
    borderColor: 'rgba(50, 77, 122, 0.24)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: 'rgba(27, 43, 68, 0.5)',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 13,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
  },
  iconMirror: {
    transform: [{ rotate: '180deg' }],
  },
});
