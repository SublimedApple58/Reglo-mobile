import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { instructorSettingsStore, type InstrAvailabilityMode } from '../../../src/stores/instructorSettingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const OPTIONS: { value: InstrAvailabilityMode; label: string; desc: string }[] = [
  { value: 'default', label: 'Predefinita', desc: 'La tua disponibilità abituale, valida ogni settimana.' },
  { value: 'publication', label: 'Pubblicazione', desc: 'Compili e pubblichi la disponibilità settimana per settimana.' },
];

export default function AvailabilityModeScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(instructorSettingsStore.subscribe, instructorSettingsStore.get);
  const [selected, setSelected] = useState<InstrAvailabilityMode>(data?.availabilityMode ?? 'default');

  if (!data) return <View style={s.root} />;

  const { onPickAvailabilityMode } = data;

  return (
    <View style={s.root}>
      <Text style={s.title}>Disponibilità</Text>
      <Text style={s.subtitle}>Come gestisci gli orari in cui sei prenotabile.</Text>

      <View style={s.list}>
        {OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setSelected(opt.value)}
              style={({ pressed }) => [s.optRow, active && s.optRowActive, pressed && { opacity: 0.9 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.optLabel}>{opt.label}</Text>
                <Text style={s.optDesc}>{opt.desc}</Text>
              </View>
              {active ? (
                <View style={s.check}><Ionicons name="checkmark" size={15} color="#FFFFFF" /></View>
              ) : (
                <View style={s.radio} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => { onPickAvailabilityMode(selected); router.back(); }}
        style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
      >
        <Text style={s.ctaText}>Salva</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 4, marginBottom: 16 },
  list: { gap: 10, marginBottom: 20 },
  optRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: colors.surface,
  },
  optRowActive: { borderColor: '#1A1A2E' },
  optLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  optDesc: { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  check: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#1A1A2E',
    alignItems: 'center', justifyContent: 'center',
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1' },
  cta: {
    backgroundColor: colors.primary, minHeight: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
