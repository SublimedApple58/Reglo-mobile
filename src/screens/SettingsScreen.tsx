import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '../components/Screen';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { colors, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { MobileStudentPaymentProfile } from '../types/regloApi';

const shouldRetryPaymentSheetWithoutWallet = (message?: string | null) => {
  const normalized = (message ?? '').toLowerCase();
  return (
    normalized.includes('merchantidentifier') ||
    normalized.includes('merchant identifier')
  );
};

export const SettingsScreen = () => {
  const { user, companies, activeCompanyId, refreshMe, signOut, autoscuolaRole } = useSession();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [availabilityWeeks, setAvailabilityWeeks] = useState('4');
  const [studentReminderMinutes, setStudentReminderMinutes] = useState('60');
  const [instructorReminderMinutes, setInstructorReminderMinutes] = useState('60');
  const [refreshing, setRefreshing] = useState(false);
  const [paymentProfile, setPaymentProfile] = useState<MobileStudentPaymentProfile | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const activeCompany = useMemo(
    () => companies.find((item) => item.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user]);

  const loadSettings = useCallback(async () => {
    try {
      if (autoscuolaRole === 'OWNER') {
        const settings = await regloApi.getAutoscuolaSettings();
        setAvailabilityWeeks(String(settings.availabilityWeeks));
        setStudentReminderMinutes(String(settings.studentReminderMinutes));
        setInstructorReminderMinutes(String(settings.instructorReminderMinutes));
      }
      if (autoscuolaRole === 'STUDENT') {
        const profile = await regloApi.getPaymentProfile();
        setPaymentProfile(profile);
      } else {
        setPaymentProfile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricando impostazioni');
    }
  }, [autoscuolaRole]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError('Nome troppo corto');
      return;
    }

    setSaving(true);
    setError(null);
    setToast(null);
    try {
      await regloApi.updateProfile({ name: trimmed });
      await refreshMe();
      setToast({ text: 'Profilo aggiornato', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando profilo');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSaveWeeks = async () => {
    const parsed = Number(availabilityWeeks);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) {
      setError('Numero settimane non valido');
      return;
    }
    const studentReminder = Number(studentReminderMinutes);
    const instructorReminder = Number(instructorReminderMinutes);
    const allowedReminderMinutes = [120, 60, 30, 20, 15];
    if (!allowedReminderMinutes.includes(studentReminder)) {
      setError('Preavviso allievo non valido');
      return;
    }
    if (!allowedReminderMinutes.includes(instructorReminder)) {
      setError('Preavviso istruttore non valido');
      return;
    }
    setError(null);
    setToast(null);
    try {
      await regloApi.updateAutoscuolaSettings({
        availabilityWeeks: parsed,
        studentReminderMinutes: studentReminder as 120 | 60 | 30 | 20 | 15,
        instructorReminderMinutes: instructorReminder as 120 | 60 | 30 | 20 | 15,
      });
      setToast({ text: 'Impostazioni aggiornate', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando impostazioni');
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setToast(null);
    try {
      await refreshMe();
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel refresh');
    } finally {
      setRefreshing(false);
    }
  }, [loadSettings, refreshMe]);

  const handleConfigurePaymentMethod = async () => {
    if (autoscuolaRole !== 'STUDENT') return;
    setPaymentLoading(true);
    setError(null);
    setToast(null);
    try {
      const setup = await regloApi.createSetupIntent();
      const baseSheetConfig = {
        merchantDisplayName: 'Reglo Autoscuole',
        customerId: setup.customerId,
        customerEphemeralKeySecret: setup.ephemeralKey,
        setupIntentClientSecret: setup.setupIntentClientSecret,
        defaultBillingDetails: {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
        },
      } as const;

      let init = await initPaymentSheet({
        ...baseSheetConfig,
        applePay: { merchantCountryCode: 'IT' },
        googlePay: { merchantCountryCode: 'IT', testEnv: __DEV__ },
      });

      if (init.error && shouldRetryPaymentSheetWithoutWallet(init.error.message)) {
        init = await initPaymentSheet(baseSheetConfig);
        if (!init.error) {
          setToast({
            text: 'Apple Pay non disponibile su questa build. Usa carta o Link.',
            tone: 'info',
          });
        }
      }

      if (init.error) {
        throw new Error(init.error.message);
      }

      const result = await presentPaymentSheet();
      if (result.error) {
        throw new Error(result.error.message);
      }

      await regloApi.confirmPaymentMethod({
        setupIntentId: setup.setupIntentId,
      });
      const profile = await regloApi.getPaymentProfile();
      setPaymentProfile(profile);
      setToast({ text: 'Metodo di pagamento salvato', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore configurando pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  const logoLabel = (activeCompany?.name ?? '?').slice(0, 1).toUpperCase();

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice
        message={toast?.text ?? null}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Profilo e autoscuola</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard title="Profilo">
          <View style={styles.form}>
            <GlassInput placeholder="Nome" value={name} onChangeText={setName} />
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

        {autoscuolaRole === 'OWNER' ? (
          <GlassCard title="Disponibilita autoscuola">
            <View style={styles.form}>
              <GlassInput
                placeholder="Settimane disponibilita (1-12)"
                value={availabilityWeeks}
                onChangeText={setAvailabilityWeeks}
                keyboardType="number-pad"
              />
              <GlassInput
                placeholder="Reminder allievo (120,60,30,20,15)"
                value={studentReminderMinutes}
                onChangeText={setStudentReminderMinutes}
                keyboardType="number-pad"
              />
              <GlassInput
                placeholder="Reminder istruttore (120,60,30,20,15)"
                value={instructorReminderMinutes}
                onChangeText={setInstructorReminderMinutes}
                keyboardType="number-pad"
              />
              <GlassButton label="Salva impostazioni" onPress={handleSaveWeeks} />
            </View>
          </GlassCard>
        ) : null}

        {autoscuolaRole === 'STUDENT' ? (
          <GlassCard title="Metodo di pagamento">
            <View style={styles.form}>
              {paymentProfile?.hasPaymentMethod && paymentProfile.paymentMethod ? (
                <Text style={styles.companyMeta}>
                  Carta {paymentProfile.paymentMethod.brand.toUpperCase()} ••••
                  {paymentProfile.paymentMethod.last4}
                </Text>
              ) : (
                <Text style={styles.companyMeta}>Nessun metodo salvato.</Text>
              )}
              {paymentProfile?.blockedByInsoluti ? (
                <Text style={styles.error}>Hai pagamenti insoluti. Salda dalla Home.</Text>
              ) : null}
              <GlassButton
                label={
                  paymentLoading
                    ? 'Attendi...'
                    : paymentProfile?.hasPaymentMethod
                    ? 'Aggiorna metodo'
                    : 'Aggiungi metodo'
                }
                onPress={handleConfigurePaymentMethod}
                disabled={paymentLoading}
              />
            </View>
          </GlassCard>
        ) : null}

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
});
