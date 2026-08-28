import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { GradientCTA } from '../components/GradientCTA';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { queryKeys } from '../hooks/queries/queryKeys';
import {
  STUDENT_LICENSE_CATEGORIES,
  TRANSMISSIONS,
  TRANSMISSION_LABELS,
  isMotoLicenseCategory,
} from '../utils/license';
import type { LicenseCategory, Transmission } from '../types/regloApi';
import { colors } from '../theme';

const NAVY = colors.primary; // #1A1A2E

// Short descriptor shown under each license code. Kept here (not in the shared
// taxonomy) because it's copy specific to this student-facing gate.
const CATEGORY_DESCRIPTION: Record<string, string> = {
  B: 'Auto',
  AM: 'Ciclomotore',
  A1: 'Moto 125',
  A2: 'Moto media potenza',
  A: 'Moto senza limiti',
};

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Icon + one-word gloss for each transmission choice (cars and moto alike).
const TRANSMISSION_META: Record<Transmission, { icon: MCIName; subtitle: string }> = {
  manual: { icon: 'car-shift-pattern', subtitle: 'Con frizione' },
  automatic: { icon: 'alpha-a-circle', subtitle: 'Senza frizione' },
};

/**
 * REG-410 — blocking gate for a student who registered in autonomy (mobile
 * sign-up): replaces the whole tab tree (mounted from `app/(tabs)/_layout.tsx`,
 * beside the phone gate) until they pick their own percorso patente. No back,
 * no close — the only ways out are confirming or signing out.
 *
 * Saves via PATCH /api/autoscuole/me/license-path, then invalidates the
 * student-phase query so `needsLicensePath` flips to false and the gate clears.
 */
export const LicensePathGateScreen = () => {
  const { activeCompanyId, refreshMe, signOut } = useSession();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<LicenseCategory | null>(null);
  // No default: the student must consciously pick the transmission — the gate
  // won't confirm until both category AND transmission are chosen.
  const [transmission, setTransmission] = useState<Transmission | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = Boolean(category && transmission);

  const handleConfirm = async () => {
    if (saving || !category || !transmission) return;
    setError(null);
    setSaving(true);
    try {
      await regloApi.setLicensePath({ licenseCategory: category, transmission });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.studentPhase(activeCompanyId),
      });
      await refreshMe();
      // On success the gate unmounts itself when the refetched payload reports
      // needsLicensePath=false, so there's no explicit navigation here.
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
      {/* Soft ambient blobs for depth (identical to the phone gate) */}
      <View style={styles.blobA} pointerEvents="none" />
      <View style={styles.blobB} pointerEvents="none" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 46 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 3D floating icon */}
        <View style={styles.iconShadow}>
          <LinearGradient
            colors={['#2B2B4A', NAVY, '#101020']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.icon3d}
          >
            <View style={styles.iconHighlight} pointerEvents="none" />
            <MaterialCommunityIcons name="card-account-details-outline" size={38} color="#F5EFE6" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>Qual è il tuo{'\n'}percorso patente?</Text>
        <Text style={styles.sub}>
          Scegli la patente che stai conseguendo: servirà alla tua autoscuola per organizzare le guide.
        </Text>

        {/* License options */}
        <View style={styles.options}>
          {STUDENT_LICENSE_CATEGORIES.map((cat) => {
            const selected = category === cat;
            const moto = isMotoLicenseCategory(cat);
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                disabled={saving}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Patente ${cat} — ${CATEGORY_DESCRIPTION[cat] ?? ''}`}
                style={[styles.opt, selected && styles.optSel]}
              >
                <View style={[styles.chip, selected && styles.chipSel]}>
                  <MaterialCommunityIcons
                    name={moto ? 'motorbike' : 'car'}
                    size={22}
                    color={selected ? '#FFFFFF' : colors.navy[400]}
                  />
                </View>
                <View style={styles.optTxt}>
                  <Text style={styles.optCode}>{cat}</Text>
                  <Text style={styles.optDesc}>{CATEGORY_DESCRIPTION[cat] ?? ''}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSel]}>
                  {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Transmission — a required, equally-weighted choice (cars and moto).
            No default selection, so the student must pick it consciously; the
            CTA stays disabled until they do. */}
        <View style={styles.transHeaderRow}>
          <Text style={styles.transTitle}>Tipo di cambio</Text>
          {!transmission ? <Text style={styles.reqPill}>OBBLIGATORIO</Text> : null}
        </View>
        <View style={styles.transRow}>
          {TRANSMISSIONS.map((t) => {
            const on = transmission === t;
            const meta = TRANSMISSION_META[t];
            return (
              <Pressable
                key={t}
                onPress={() => setTransmission(t)}
                disabled={saving}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Cambio ${TRANSMISSION_LABELS[t]}`}
                style={[styles.transCard, on && styles.transCardOn]}
              >
                {on ? (
                  <View style={styles.transCheck}>
                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  </View>
                ) : null}
                <View style={[styles.transChip, on && styles.transChipOn]}>
                  <MaterialCommunityIcons
                    name={meta.icon}
                    size={24}
                    color={on ? '#FFFFFF' : colors.navy[400]}
                  />
                </View>
                <Text style={styles.transCardLabel}>{TRANSMISSION_LABELS[t]}</Text>
                <Text style={styles.transCardSub}>{meta.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>
        {category && !transmission ? (
          <Text style={styles.transHint}>Scegli il tipo di cambio per continuare</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {/* Pinned bottom CTA */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          onPress={handleConfirm}
          disabled={saving || !canConfirm}
          style={({ pressed }) => [
            styles.ctaShadow,
            pressed && styles.ctaPressed,
            !canConfirm && !saving ? styles.ctaDisabled : null,
          ]}
        >
          <GradientCTA style={styles.cta}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.ctaText}>Conferma e continua</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
              </>
            )}
          </GradientCTA>
        </Pressable>
        <Text style={styles.logout}>
          Account sbagliato?{' '}
          <Text style={styles.logoutLink} onPress={handleLogout}>
            Esci
          </Text>
        </Text>
      </View>
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
  body: { paddingHorizontal: 24, paddingBottom: 24 },

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

  options: { marginTop: 22, gap: 10 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,46,0.06)',
    shadowColor: NAVY,
    shadowOpacity: 0.06,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  optSel: {
    borderColor: NAVY,
    backgroundColor: '#FBFBFD',
    shadowOpacity: 0.13,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.navy[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSel: { backgroundColor: NAVY },
  optTxt: { flex: 1, minWidth: 0 },
  optCode: { fontSize: 17, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  optDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.navy[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSel: { borderColor: NAVY, backgroundColor: NAVY },

  transHeaderRow: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transTitle: { fontSize: 17, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  reqPill: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.navy[400],
    backgroundColor: colors.navy[50],
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  transRow: { flexDirection: 'row', gap: 10 },
  transCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(26,26,46,0.06)',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NAVY,
    shadowOpacity: 0.06,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  transCardOn: {
    borderColor: NAVY,
    backgroundColor: '#FBFBFD',
    shadowOpacity: 0.13,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  transChip: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.navy[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  transChipOn: { backgroundColor: NAVY },
  transCardLabel: { fontSize: 16, fontWeight: '600', color: NAVY, letterSpacing: -0.2 },
  transCardSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  transCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transHint: {
    marginTop: 12,
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.navy[400],
    textAlign: 'center',
  },

  error: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.destructive,
    marginTop: 16,
    textAlign: 'center',
  },

  bottom: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: '#F6F6F9' },
  ctaShadow: {
    borderRadius: 18,
    shadowColor: NAVY,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  cta: { height: 58, borderRadius: 18, flexDirection: 'row', gap: 9 },
  ctaText: { fontSize: 16.5, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  ctaPressed: { transform: [{ scale: 0.985 }], opacity: 0.94 },
  ctaDisabled: { opacity: 0.45 },
  logout: { textAlign: 'center', marginTop: 16, fontSize: 13.5, color: colors.textMuted },
  logoutLink: { color: NAVY, fontWeight: '600', textDecorationLine: 'underline' },
});
