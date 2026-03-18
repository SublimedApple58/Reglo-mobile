import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { Input } from '../components/Input';
import { colors, radii, spacing } from '../theme';
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
        {/* Logo + Duck + Title */}
        <View style={styles.hero}>
          <Image
            source={require('../../assets/duck_login.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Reglo</Text>
          <Text style={styles.subtitle}>Accedi alla tua autoscuola</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              loading && styles.ctaDisabled,
            ]}
          >
            <Text style={styles.ctaText}>
              {loading ? 'Accesso...' : 'Accedi'}
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
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
            Registrati come allievo
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
    gap: 32,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 110,
    height: 154,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#94A3B8',
  },
  form: {
    gap: 12,
  },
  error: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.destructive,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#94A3B8',
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});
