import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { colors, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';

export const CompanySelectScreen = () => {
  const { companies, selectCompany, signOut, user } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = async (companyId: string) => {
    setError(null);
    setLoadingId(companyId);
    try {
      await selectCompany(companyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Selezione non riuscita');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Seleziona autoscuola</Text>
          <Text style={styles.subtitle}>Ciao {user?.name ?? user?.email}</Text>
        </View>

        <GlassCard>
          <View style={styles.list}>
            {companies.map((company) => (
              <GlassButton
                key={company.id}
                label={loadingId === company.id ? 'Seleziono...' : company.name}
                onPress={() => handleSelect(company.id)}
              />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </GlassCard>

        <GlassButton label="Esci" onPress={signOut} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.sm,
  },
});
