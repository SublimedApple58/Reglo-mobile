import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { Input } from '../components/Input';
import { colors, radii, spacing } from '../theme';
import { useSession } from '../context/SessionContext';
import { useRouter } from 'expo-router';

type SignupScreenProps = {
  onLogin?: () => void;
};

export const SignupScreen = ({ onLogin }: SignupScreenProps) => {
  const { signUp } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await signUp({
        name,
        email: email.trim(),
        phone: phone.trim(),
        password,
        confirmPassword,
        schoolCode: schoolCode.trim().toUpperCase(),
      });
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
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.hero}>
          <Image
            source={require('../../assets/duck_login.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Crea account allievo</Text>
          <Text style={styles.subtitle}>Inserisci il codice della tua autoscuola</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input placeholder="Nome completo" value={name} onChangeText={setName} />
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Numero di cellulare"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          <Input
            placeholder="Conferma password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <View style={styles.codeWrapper}>
            <Text style={styles.codeLabel}>Codice autoscuola</Text>
            <TextInput
              style={styles.codeInput}
              value={schoolCode}
              onChangeText={(text) => setSchoolCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              placeholder="ABC123"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={handleSignup}
            disabled={loading}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              loading && styles.ctaDisabled,
            ]}
          >
            <Text style={styles.ctaText}>
              {loading ? 'Creazione...' : 'Crea account'}
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Hai già un account?</Text>
          <Text
            style={styles.footerLink}
            onPress={() => {
              if (onLogin) {
                onLogin();
              } else {
                router.back();
              }
            }}
          >
            Accedi
          </Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 28,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 90,
    height: 126,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
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
  codeWrapper: {
    gap: 6,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: colors.pink[200],
    backgroundColor: colors.pink[50],
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.textPrimary,
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
