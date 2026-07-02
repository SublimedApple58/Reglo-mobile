import React, { useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GradientCTABackground } from '../../../src/components/GradientCTA';
import { SelectableChip } from '../../../src/components/SelectableChip';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
import { clusterSettingsStore } from '../../../src/stores/clusterSettingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

const ACTOR_OPTIONS = [
  { value: undefined, label: 'Default' },
  { value: 'students', label: 'Solo allievi' },
  { value: 'instructors', label: 'Solo istruttori' },
  { value: 'both', label: 'Entrambi' },
] as const;

const MODE_OPTIONS = [
  { value: undefined, label: 'Default' },
  { value: 'manual_full', label: 'Manuale totale' },
  { value: 'manual_engine', label: 'Manuale + motore' },
] as const;

export default function BookingRulesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(clusterSettingsStore.subscribe, clusterSettingsStore.get);
  if (!data) return <View style={s.root} />;

  const {
    appBookingActors, setAppBookingActors,
    instructorBookingMode, setInstructorBookingMode,
    bookingSlotDurations, toggleDuration,
    roundedHoursOnly, setRoundedHoursOnly,
    saving, onSave,
  } = data;

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title}>Prenotazione guide</Text>
        <Text style={s.subtitle}>Chi può prenotare, modalità e durate.</Text>
      </View>

      <SheetScaffold
        style={{ gap: 20 }}
        contentContainerStyle={{ gap: 20 }}
        footer={
          <Pressable
            onPress={saving ? undefined : async () => { await onSave(); router.back(); }}
            disabled={saving}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }, saving && { opacity: 0.6 }]}
          >
            <GradientCTABackground radius={27} />
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>Salva</Text>}
          </Pressable>
        }
      >
      <View style={s.section}>
        <Text style={s.label}>Chi prenota</Text>
        <View style={s.chips}>
          {ACTOR_OPTIONS.map((opt) => (
            <SelectableChip
              key={opt.value ?? '_default'}
              label={opt.label}
              active={appBookingActors === opt.value}
              onPress={() => setAppBookingActors(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.label}>Modalità istruttore</Text>
        <View style={s.chips}>
          {MODE_OPTIONS.map((opt) => (
            <SelectableChip
              key={opt.value ?? '_default'}
              label={opt.label}
              active={instructorBookingMode === opt.value}
              onPress={() => setInstructorBookingMode(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.label}>Durata guide</Text>
        <View style={s.chips}>
          {DURATION_OPTIONS.map((dur) => (
            <SelectableChip
              key={dur}
              label={`${dur} min`}
              active={bookingSlotDurations.includes(dur)}
              onPress={() => toggleDuration(dur)}
            />
          ))}
        </View>
      </View>

      <View style={s.card}>
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Solo orari tondi</Text>
            <Text style={s.toggleDesc}>Slot solo a ore piene (es. 9:00, 10:00).</Text>
          </View>
          <ToggleSwitch value={roundedHoursOnly} onValueChange={setRoundedHoursOnly} />
        </View>
      </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  section: { gap: 11 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  toggleDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  cta: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
