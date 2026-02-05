import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { colors, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';

export const SettingsScreen = () => {
  const { user, companies, activeCompanyId, refreshMe, signOut } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeCompany = useMemo(
    () => companies.find((item) => item.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError('Nome troppo corto');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await regloApi.updateProfile({ name: trimmed });
      await refreshMe();
      setMessage('Profilo aggiornato');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando profilo');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const logoLabel = (activeCompany?.name ?? '?').slice(0, 1).toUpperCase();

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Profilo e autoscuola</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <GlassCard title="Profilo">
          <View style={styles.form}>
            <GlassInput placeholder="Nome" value={name} onChangeText={setName} />
            <GlassInput placeholder="Email" value={email} editable={false} />
          </View>
          <GlassButton
            label={saving ? 'Salvataggio...' : 'Salva'}
            onPress={handleSave}
          />
        </GlassCard>

        <GlassCard title="Autoscuola attiva">
          <View style={styles.companyRow}>
            <View style={styles.logoWrap}>
              {activeCompany?.logoUrl ? (
                <Image source={{ uri: activeCompany.logoUrl }} style={styles.logo} />
              ) : (
                <Text style={styles.logoFallback}>{logoLabel}</Text>
              )}
            </View>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>
                {activeCompany?.name ?? 'Nessuna autoscuola'}
              </Text>
              <Text style={styles.companyMeta}>Autoscuola attiva</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard title="Account">
          <GlassButton label="Logout" onPress={handleSignOut} />
        </GlassCard>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
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
  form: {
    gap: spacing.sm,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  logo: {
    width: 56,
    height: 56,
    resizeMode: 'cover',
  },
  logoFallback: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  companyMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
  message: {
    ...typography.body,
    color: colors.success,
  },
});
