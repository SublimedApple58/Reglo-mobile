import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
};

export const Screen = ({ children }: ScreenProps) => {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.backgroundTop, colors.backgroundBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundTop,
  },
  safe: {
    flex: 1,
  },
});
