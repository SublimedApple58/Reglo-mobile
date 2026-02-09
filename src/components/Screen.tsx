import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
};

export const Screen = ({ children }: ScreenProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.backgroundTop, colors.backgroundBottom]}
        locations={[0, 0.75]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {Platform.OS === 'ios' ? (
        <View style={[styles.topOverlay, { height: insets.top }]}>
          <BlurView
            intensity={10}
            tint="light"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
      ) : null}
      <View style={[styles.content, { paddingTop: insets.top }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundTop,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    opacity: 0.45,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
