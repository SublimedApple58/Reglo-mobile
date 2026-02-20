import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export const LoadingScreen = () => {
  const sliderX = useRef(new Animated.Value(-96)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sliderX, {
          toValue: 96,
          duration: 980,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sliderX, {
          toValue: -96,
          duration: 980,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sliderX]);

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <Image
          source={require('../../assets/logo-text.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barSlider,
              {
                transform: [{ translateX: sliderX }],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  logo: {
    width: 222,
    height: 222,
  },
  barTrack: {
    width: 190,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(50, 77, 122, 0.14)',
    overflow: 'hidden',
  },
  barSlider: {
    width: 78,
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.navy,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
