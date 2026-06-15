import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { RegloLogo } from '../components/RegloLogo';
import { colors } from '../theme';

const NAVY = colors.primary; // #1A1A2E

export const LoadingScreen = () => {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <RegloLogo size={300} animated />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
