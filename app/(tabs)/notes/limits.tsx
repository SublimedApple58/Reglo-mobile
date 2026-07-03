import React, { useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { SelectableChip } from '../../../src/components/SelectableChip';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
import { clusterSettingsStore } from '../../../src/stores/clusterSettingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const WEEKLY_OPTIONS = [1, 2, 3, 4, 5, 7, 10] as const;

// Defined at module level (NOT inside the screen) so they are not remounted on
// every render — that would reset the ToggleSwitch's animation shared value.
const ToggleRow = ({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) => (
  <View style={s.toggleRow}>
    <View style={{ flex: 1 }}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Text style={s.toggleDesc}>{on ? 'Attivo' : 'Disattivo'}</Text>
    </View>
    <ToggleSwitch value={on} onValueChange={onChange} />
  </View>
);

const SelectRow = ({ label, value, onPress }: { label: string; value: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.selectRow, pressed && { opacity: 0.6 }]}>
    <Text style={s.selectLabel}>{label}</Text>
    <Text style={s.selectValue}>{value}</Text>
    <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
  </Pressable>
);

export default function LimitsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(clusterSettingsStore.subscribe, clusterSettingsStore.get);
  if (!data) return <View style={s.root} />;

  const {
    companyDefaults: cd,
    bookingCutoffEnabled, setBookingCutoffEnabled,
    bookingCutoffTime, setBookingCutoffTime,
    weeklyLimitEnabled, setWeeklyLimitEnabled,
    weeklyLimit, setWeeklyLimit,
    restrictedTimeEnabled, setRestrictedTimeEnabled,
    restrictedTimeStart, setRestrictedTimeStart,
    restrictedTimeEnd, setRestrictedTimeEnd,
    openTimePicker, saving, onSave,
  } = data;

  const cutoffOn = bookingCutoffEnabled ?? cd.bookingCutoffEnabled;
  const limitOn = weeklyLimitEnabled ?? cd.weeklyBookingLimitEnabled;
  const rangeOn = restrictedTimeEnabled ?? cd.restrictedTimeRangeEnabled;

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title}>Limiti e orari</Text>
        <Text style={s.subtitle}>Cutoff, limite settimanale e fasce orarie.</Text>
      </View>

      <SheetScaffold
        style={{ gap: 16 }}
        contentContainerStyle={{ gap: 16 }}
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
      {/* Cutoff */}
      <View style={s.card}>
        <ToggleRow label="Cutoff prenotazione" on={cutoffOn} onChange={setBookingCutoffEnabled} />
        {cutoffOn ? (
          <>
            <View style={s.divider} />
            <SelectRow label="Orario limite" value={bookingCutoffTime ?? cd.bookingCutoffTime} onPress={() => openTimePicker(bookingCutoffTime ?? cd.bookingCutoffTime, setBookingCutoffTime)} />
          </>
        ) : null}
      </View>

      {/* Limite settimanale */}
      <View style={s.card}>
        <ToggleRow label="Limite settimanale" on={limitOn} onChange={setWeeklyLimitEnabled} />
        {limitOn ? (
          <>
            <View style={s.divider} />
            <View style={s.chipsRow}>
              {WEEKLY_OPTIONS.map((n) => (
                <SelectableChip
                  key={n}
                  label={`${n}`}
                  active={(weeklyLimit ?? cd.weeklyBookingLimit) === n}
                  onPress={() => setWeeklyLimit(n)}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>

      {/* Fascia oraria ristretta */}
      <View style={s.card}>
        <ToggleRow label="Fascia oraria ristretta" on={rangeOn} onChange={setRestrictedTimeEnabled} />
        {rangeOn ? (
          <>
            <View style={s.divider} />
            <SelectRow label="Inizio" value={restrictedTimeStart ?? cd.restrictedTimeRangeStart} onPress={() => openTimePicker(restrictedTimeStart ?? cd.restrictedTimeRangeStart, setRestrictedTimeStart)} />
            <View style={s.divider} />
            <SelectRow label="Fine" value={restrictedTimeEnd ?? cd.restrictedTimeRangeEnd} onPress={() => openTimePicker(restrictedTimeEnd ?? cd.restrictedTimeRangeEnd, setRestrictedTimeEnd)} />
          </>
        ) : null}
      </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  card: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  toggleDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  selectLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  selectValue: { fontSize: 15, fontWeight: '600', color: '#64748B' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 14 },

  cta: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
