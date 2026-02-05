import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { GlassInput } from '../components/GlassInput';
import { colors, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthNavigator';

export type SignupScreenProps = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export const SignupScreen = ({ navigation }: SignupScreenProps) => {
  const { signUp } = useSession();
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await signUp({ companyName, name, email: email.trim(), password, confirmPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione non riuscita');
    } finally {
      setLoading(false);
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
          <Text style={styles.title}>Crea account</Text>
          <Text style={styles.subtitle}>Reglo Autoscuole</Text>
        </View>

        <GlassCard>
          <View style={styles.form}>
            <GlassInput placeholder="Nome autoscuola" value={companyName} onChangeText={setCompanyName} />
            <GlassInput placeholder="Nome completo" value={name} onChangeText={setName} />
            <GlassInput
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <GlassInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
            <GlassInput
              placeholder="Conferma password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <GlassButton label={loading ? 'Creazione...' : 'Crea account'} onPress={handleSignup} />
          </View>
        </GlassCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hai gia un account?</Text>
          <Text style={styles.footerLink} onPress={() => navigation.goBack()}>
            Accedi
          </Text>
        </View>
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
  error: {
    ...typography.body,
    color: colors.danger,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footerLink: {
    ...typography.body,
    color: colors.navy,
    fontWeight: '700',
  },
});
