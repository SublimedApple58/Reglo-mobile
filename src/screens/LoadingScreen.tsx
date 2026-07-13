import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { RegloLogo } from '../components/RegloLogo';

export const LoadingScreen = () => {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <RegloLogo size={200} animated tone="navy" />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
