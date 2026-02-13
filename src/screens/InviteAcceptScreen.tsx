import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

import { Screen } from '../components/Screen';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { GlassInput } from '../components/GlassInput';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { MobileInviteContext } from '../types/regloApi';
import { colors, spacing, typography } from '../theme';

const PHONE_PREFIX_OPTIONS = ['+39', '+41', '+33', '+34', '+49', '+44'];

export const InviteAcceptScreen = () => {
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { refreshMe } = useSession();

  const token = typeof params.token === 'string' ? params.token : '';

  const [context, setContext] = useState<MobileInviteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+39');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPrefixMenu, setShowPrefixMenu] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const normalizedPhone = useMemo(() => {
    const cleanPrefix = phonePrefix.replace(/[^\d+]/g, '');
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (!cleanNumber) return '';
    return `${cleanPrefix}${cleanNumber}`;
  }, [phoneNumber, phonePrefix]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!token) {
        if (mounted) {
          setError('Invito non valido.');
          setLoading(false);
        }
        return;
      }
      try {
        const inviteContext = await regloApi.getInviteContext(token);
        if (!mounted) return;
        setContext(inviteContext);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Invito non disponibile');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [token]);

  const canSubmit = useMemo(() => {
    if (!context) return false;
    if (context.hasAccount) {
      if (!password.trim()) return false;
      if (context.requiresPhone && !normalizedPhone) return false;
      return true;
    }

    if (!name.trim() || !password.trim() || !confirmPassword.trim()) return false;
    if (context.requiresPhone && !normalizedPhone) return false;
    return true;
  }, [confirmPassword, context, name, normalizedPhone, password]);

  const handleAccept = async () => {
    if (!context || !token) return;

    setSaving(true);
    setError(null);

    try {
      if (context.hasAccount) {
        await regloApi.acceptInvite(token, {
          mode: 'existing',
          password,
          phone: normalizedPhone || undefined,
        });
      } else {
        await regloApi.acceptInvite(token, {
          mode: 'register',
          name: name.trim(),
          password,
          confirmPassword,
          phone: normalizedPhone || undefined,
        });
      }

      await refreshMe();
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante accettazione invito');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Invito autoscuola</Text>
          <Text style={styles.subtitle}>Completa l&apos;accesso e entra direttamente in app</Text>
        </View>

        <GlassCard>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.navy} />
              <Text style={styles.infoText}>Caricamento invito...</Text>
            </View>
          ) : error || !context ? (
            <View style={styles.form}>
              <Text style={styles.error}>{error ?? 'Invito non disponibile'}</Text>
              <GlassButton label="Vai al login" onPress={() => router.replace('/(auth)/login')} />
            </View>
          ) : context.alreadyMember ? (
            <View style={styles.form}>
              <Text style={styles.infoText}>Sei già membro di {context.companyName}.</Text>
              <GlassButton label="Accedi" onPress={() => router.replace('/(auth)/login')} />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.companyName}>{context.companyName}</Text>
              <Text style={styles.inviteEmail}>{context.email}</Text>

              {!context.hasAccount ? (
                <GlassInput
                  placeholder="Nome completo"
                  value={name}
                  onChangeText={setName}
                />
              ) : null}

              {context.requiresPhone ? (
                <View style={styles.phoneBlock}>
                  <Text style={styles.phoneLabel}>Cellulare</Text>
                  <View style={styles.phoneRow}>
                    <View style={styles.prefixSelectContainer}>
                      <View style={styles.prefixSelectWrap}>
                        <BlurView intensity={24} tint="light" style={styles.phoneFieldBlur}>
                          <Pressable
                            style={styles.prefixSelectButton}
                            onPress={() => setShowPrefixMenu((prev) => !prev)}
                          >
                            <Text style={styles.prefixValue}>{phonePrefix}</Text>
                            <Text style={styles.prefixChevron}>▾</Text>
                          </Pressable>
                        </BlurView>
                      </View>

                      {showPrefixMenu ? (
                        <View style={styles.prefixDropdown}>
                          {PHONE_PREFIX_OPTIONS.map((option) => (
                            <Pressable
                              key={option}
                              onPress={() => {
                                setPhonePrefix(option);
                                setShowPrefixMenu(false);
                              }}
                              style={[
                                styles.prefixOption,
                                option === phonePrefix && styles.prefixOptionActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.prefixOptionText,
                                  option === phonePrefix && styles.prefixOptionTextActive,
                                ]}
                              >
                                {option}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.phoneInputWrap}>
                      <BlurView intensity={24} tint="light" style={styles.phoneFieldBlur}>
                        <TextInput
                          value={phoneNumber}
                          onChangeText={setPhoneNumber}
                          keyboardType="phone-pad"
                          placeholder="Numero"
                          placeholderTextColor={colors.textMuted}
                          style={styles.phoneInput}
                          onFocus={() => setShowPrefixMenu(false)}
                        />
                      </BlurView>
                    </View>
                  </View>

                </View>
              ) : null}

              <GlassInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {!context.hasAccount ? (
                <GlassInput
                  placeholder="Conferma password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <GlassButton
                label={saving ? 'Attendi...' : 'Entra in autoscuola'}
                onPress={handleAccept}
                disabled={!canSubmit || saving}
              />
            </View>
          )}
        </GlassCard>
      </KeyboardAvoidingView>
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
  form: {
    gap: spacing.md,
  },
  phoneBlock: {
    gap: spacing.xs,
  },
  phoneLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  prefixSelectContainer: {
    width: 96,
    position: 'relative',
    zIndex: 20,
  },
  prefixSelectWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  prefixSelectButton: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.glass,
  },
  prefixValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  prefixChevron: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  prefixDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  phoneInputWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  phoneFieldBlur: {
    borderRadius: 16,
  },
  phoneInput: {
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glass,
    minHeight: 48,
  },
  prefixOption: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: '#fff',
  },
  prefixOptionActive: {
    backgroundColor: '#EEF3FB',
  },
  prefixOptionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  prefixOptionTextActive: {
    color: colors.navy,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  companyName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  inviteEmail: {
    ...typography.body,
    color: colors.textSecondary,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
});
