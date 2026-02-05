import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing, typography } from '../theme';

export const RoleBlockedScreen = () => {
  const handleContact = () => {
    Alert.alert('Contatta admin', 'Funzione non ancora attiva.');
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <GlassCard title="Accesso non abilitato">
          <Text style={styles.message}>
            Il tuo ruolo autoscuola non e configurato. Contatta l'amministratore per
            sbloccare l'accesso.
          </Text>
          <GlassButton label="Contatta admin" onPress={handleContact} />
        </GlassCard>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
