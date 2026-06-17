import React, { useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { settingsStore, SlotTarget } from '../../../src/stores/settingsStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
const toTimeStr = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function AvailabilityScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(settingsStore.subscribe, settingsStore.get);

  if (!data) return <View style={s.root} />;

  const {
    hasProfile, weeks, availabilityDays, toggleDay,
    morningActive, afternoonActive, toggleMorning, toggleAfternoon,
    morningStart, morningEnd, afternoonStart, afternoonEnd,
    onPickSlotTime, availabilitySaving, onSaveAvailability,
  } = data;

  const openPicker = (target: SlotTarget, current: Date) => {
    timePickerStore.set({
      selectedTime: current,
      onConfirm: (date) => onPickSlotTime(target, date),
    });
    router.push('/(tabs)/settings/time-picker');
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <SheetScaffold
        style={{ gap: 16 }}
        contentContainerStyle={{ gap: 16 }}
        footer={
          hasProfile ? (
            <Pressable
              onPress={() => { onSaveAvailability(); router.back(); }}
              disabled={availabilitySaving}
              style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }, availabilitySaving && { opacity: 0.6 }]}
            >
              <Text style={s.ctaText}>{availabilitySaving ? 'Salvataggio...' : 'Salva'}</Text>
            </Pressable>
          ) : null
        }
      >
        <Text style={s.title}>Disponibilità</Text>

        {!hasProfile ? (
          <Text style={s.hint}>Profilo non collegato alla company attiva.</Text>
        ) : (
          <>
            <Text style={s.hint}>Ripetizione ogni {weeks} settimane</Text>

            <View style={s.dayRow}>
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const active = availabilityDays.includes(d);
                return (
                  <Pressable key={d} onPress={() => toggleDay(d)} style={[s.day, active ? s.dayOn : s.dayOff]}>
                    <Text style={[s.dayText, active ? s.dayTextOn : s.dayTextOff]}>{DAY_LETTERS[d]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: 10 }}>
              <View style={{ gap: 8 }}>
                <Pressable onPress={toggleMorning} style={s.slotRow}>
                  <Text style={[s.slotLabel, { color: morningActive ? '#1A1A2E' : '#9CA3AF' }]}>Mattina</Text>
                  <View style={[s.slotDot, { backgroundColor: morningActive ? '#22C55E' : '#D1D5DB' }]} />
                </Pressable>
                {morningActive && (
                  <View style={s.timeRow}>
                    <Pressable style={s.timeCard} onPress={() => openPicker('morningStart', morningStart)}>
                      <Text style={s.timeText}>{toTimeStr(morningStart)}</Text>
                    </Pressable>
                    <Text style={s.sep}>—</Text>
                    <Pressable style={s.timeCard} onPress={() => openPicker('morningEnd', morningEnd)}>
                      <Text style={s.timeText}>{toTimeStr(morningEnd)}</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={{ gap: 8 }}>
                <Pressable onPress={toggleAfternoon} style={s.slotRow}>
                  <Text style={[s.slotLabel, { color: afternoonActive ? '#1A1A2E' : '#9CA3AF' }]}>Pomeriggio</Text>
                  <View style={[s.slotDot, { backgroundColor: afternoonActive ? '#22C55E' : '#D1D5DB' }]} />
                </Pressable>
                {afternoonActive && (
                  <View style={s.timeRow}>
                    <Pressable style={s.timeCard} onPress={() => openPicker('afternoonStart', afternoonStart)}>
                      <Text style={s.timeText}>{toTimeStr(afternoonStart)}</Text>
                    </Pressable>
                    <Text style={s.sep}>—</Text>
                    <Pressable style={s.timeCard} onPress={() => openPicker('afternoonEnd', afternoonEnd)}>
                      <Text style={s.timeText}>{toTimeStr(afternoonEnd)}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, marginBottom: 4 },
  hint: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  dayRow: { flexDirection: 'row', gap: 8 },
  day: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: '#1A1A2E' },
  dayOff: { backgroundColor: 'rgba(26,18,10,0.06)' },
  dayText: { fontWeight: '700', fontSize: 14 },
  dayTextOn: { color: '#FFFFFF' },
  dayTextOff: { color: '#9CA3AF' },
  slotRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  slotLabel: { fontSize: 15, fontWeight: '600' },
  slotDot: { width: 12, height: 12, borderRadius: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  timeCard: {
    flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  timeText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  sep: { fontSize: 14, color: '#9CA3AF' },
  cta: {
    backgroundColor: colors.primary, minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
