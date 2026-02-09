import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { GlassInput } from '../components/GlassInput';
import { colors, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { useRouter } from 'expo-router';

type LoginScreenProps = {
  onSignup?: () => void;
};

export const LoginScreen = ({ onSignup }: LoginScreenProps) => {
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login non riuscito');
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
          <Text style={styles.title}>Reglo</Text>
          <Text style={styles.subtitle}>Accedi alla tua autoscuola</Text>
        </View>

        <GlassCard>
          <View style={styles.form}>
            <GlassInput
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <GlassInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <GlassButton label={loading ? 'Accesso...' : 'Accedi'} onPress={handleLogin} />
          </View>
        </GlassCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Non hai un account?</Text>
          <Text
            style={styles.footerLink}
            onPress={() => {
              if (onSignup) {
                onSignup();
              } else {
                router.push('/(auth)/signup');
              }
            }}
          >
            Crea account
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
