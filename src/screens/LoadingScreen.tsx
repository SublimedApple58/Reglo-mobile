import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme';

export const LoadingScreen = () => {
  return (
    <Screen>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.text}>Caricamento sessione...</Text>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
