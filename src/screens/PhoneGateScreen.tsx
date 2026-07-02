import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { colors } from '../theme';

const NAVY = colors.primary; // #1A1A2E

/**
 * Blocking gate for students without a phone number: replaces the whole tab
 * tree (mounted from `app/(tabs)/_layout.tsx`) until the number is saved.
 * No back, no close — the only ways out are saving or signing out.
 *
 * Saves via PATCH /api/mobile/profile (name is required by the endpoint, so
 * the current one is re-sent untouched), then refreshMe() clears the gate.
 */
export const PhoneGateScreen = () => {
  const { user, refreshMe, signOut } = useSession();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Strip an explicit +39 / 0039 prefix, then keep digits only. Never strip a
  // bare leading "39": Italian mobiles like 393... are real numbers.
  const digits = useMemo(() => {
    const raw = phone.trim().replace(/^(\+39|0039)/, '');
    return raw.replace(/\D/g, '');
  }, [phone]);
  const isValid = digits.length >= 8 && digits.length <= 11;

  const handleSave = async () => {
    if (saving || !isValid || !user) return;
    setError(null);
    setSaving(true);
    try {
      await regloApi.updateProfile({
        name: user.name?.trim() || user.email,
        phone: `+39 ${digits}`,
      });
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito. Riprova.');
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Esci dall'account", 'Vuoi davvero uscire?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {/* Soft ambient blobs for depth */}
      <View style={styles.blobA} pointerEvents="none" />
      <View style={styles.blobB} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={[styles.body, { paddingTop: insets.top + 46 }]}>
          {/* 3D floating icon */}
          <View style={styles.iconShadow}>
            <LinearGradient
              colors={['#2B2B4A', NAVY, '#101020']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.icon3d}
            >
              <View style={styles.iconHighlight} pointerEvents="none" />
              <Ionicons name="call-outline" size={40} color="#F5EFE6" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Aggiungi il tuo{'\n'}numero di cellulare</Text>
          <Text style={styles.sub}>
            Serve alla tua autoscuola per avvisarti su guide, esami e cambi di programma.
          </Text>

          {/* Floating input card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Numero di cellulare</Text>
            <View style={styles.inputRow}>
              <Text style={styles.flag}>🇮🇹</Text>
              <Text style={styles.prefix}>+39</Text>
              <View style={styles.inputDivider} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="333 123 4567"
                placeholderTextColor="#AEB4CC"
                autoFocus
                editable={!saving}
              />
            </View>
            <View style={styles.privacyRow}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
              <Text style={styles.privacyText}>Lo vede solo la tua autoscuola</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* Floating bottom CTA */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
          <Pressable
            onPress={handleSave}
            disabled={saving || !isValid}
            style={({ pressed }) => [
              styles.ctaShadow,
              pressed && styles.ctaPressed,
              !isValid && !saving ? styles.ctaDisabled : null,
            ]}
          >
            <LinearGradient
              colors={['#26263F', NAVY, '#131322']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.cta}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Salva e continua</Text>
                  <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </Pressable>
          <Text style={styles.logout}>
            Account sbagliato?{' '}
            <Text style={styles.logoutLink} onPress={handleLogout}>
              Esci
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F6F9' },
  blobA: {
    position: 'absolute',
    top: -80,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(26,26,46,0.04)',
  },
  blobB: {
    position: 'absolute',
    top: 220,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(250,204,21,0.07)',
  },
  body: { flex: 1, paddingHorizontal: 24 },

  // 3D icon: colored drop shadow on the wrapper, gradient + top highlight inside.
  iconShadow: {
    alignSelf: 'flex-start',
    marginTop: 22,
    borderRadius: 30,
    shadowColor: NAVY,
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  icon3d: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  title: {
    fontSize: 30,
    fontWeight: '600',
    color: NAVY,
    letterSpacing: -0.7,
    lineHeight: 35,
    marginTop: 26,
  },
  sub: { fontSize: 15, color: colors.navy[400], lineHeight: 23, marginTop: 10 },

  card: {
    marginTop: 26,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(26,26,46,0.05)',
    padding: 20,
    shadowColor: NAVY,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
  },
  cardLabel: { fontSize: 13, fontWeight: '600', color: NAVY, marginLeft: 2 },
  inputRow: {
    marginTop: 10,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.navy[50],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  flag: { fontSize: 18, marginRight: 9 },
  prefix: { fontSize: 17, fontWeight: '600', color: NAVY, letterSpacing: -0.2 },
  inputDivider: { width: 1, height: 24, backgroundColor: colors.navy[200], marginHorizontal: 13 },
  input: { flex: 1, fontSize: 17, color: NAVY, letterSpacing: -0.2, height: '100%' },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    marginLeft: 2,
  },
  privacyText: { fontSize: 12.5, color: colors.textMuted },

  error: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.destructive,
    marginTop: 16,
    textAlign: 'center',
  },

  bottom: { paddingHorizontal: 24, paddingTop: 12 },
  ctaShadow: {
    borderRadius: 18,
    shadowColor: NAVY,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  cta: {
    height: 58,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  ctaText: { fontSize: 16.5, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  ctaPressed: { transform: [{ scale: 0.985 }], opacity: 0.94 },
  ctaDisabled: { opacity: 0.45 },
  logout: { textAlign: 'center', marginTop: 16, fontSize: 13.5, color: colors.textMuted },
  logoutLink: {
    color: NAVY,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
