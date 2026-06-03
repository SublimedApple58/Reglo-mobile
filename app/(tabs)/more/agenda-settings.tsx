import React, { useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SelectableChip } from '../../../src/components/SelectableChip';
import { instructorSettingsStore } from '../../../src/stores/instructorSettingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const weekPresets = [2, 4, 6, 8, 12] as const;
const reminderOptions = [120, 60, 30, 20, 15] as const;
const toReminderLabel = (m: number) => (m === 120 ? '2h' : `${m}m`);

export default function AgendaSettingsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(instructorSettingsStore.subscribe, instructorSettingsStore.get);
  if (!data) return <View style={s.root} />;

  const {
    availabilityWeeks, setAvailabilityWeeks,
    studentReminderMinutes, setStudentReminderMinutes,
    instructorReminderMinutes, setInstructorReminderMinutes,
    savingSettings, onSaveOwnerSettings,
  } = data;

  return (
    <View style={s.root}>
      <Text style={s.title}>Agenda</Text>
      <Text style={s.subtitle}>Finestra di prenotazione e promemoria.</Text>

      <View style={s.group}>
        <Text style={s.label}>Settimane prenotabili</Text>
        <View style={s.chips}>
          {weekPresets.map((w) => (
            <SelectableChip
              key={w}
              label={`${w}w`}
              active={availabilityWeeks === String(w)}
              onPress={() => setAvailabilityWeeks(String(w))}
            />
          ))}
        </View>
      </View>

      <View style={s.group}>
        <Text style={s.label}>Promemoria allievo</Text>
        <View style={s.chips}>
          {reminderOptions.map((m) => (
            <SelectableChip
              key={`student-${m}`}
              label={toReminderLabel(m)}
              active={studentReminderMinutes === String(m)}
              onPress={() => setStudentReminderMinutes(String(m))}
            />
          ))}
        </View>
      </View>

      <View style={s.group}>
        <Text style={s.label}>Promemoria istruttore</Text>
        <View style={s.chips}>
          {reminderOptions.map((m) => (
            <SelectableChip
              key={`instructor-${m}`}
              label={toReminderLabel(m)}
              active={instructorReminderMinutes === String(m)}
              onPress={() => setInstructorReminderMinutes(String(m))}
            />
          ))}
        </View>
      </View>

      <Pressable
        onPress={savingSettings ? undefined : () => { onSaveOwnerSettings(); router.back(); }}
        disabled={savingSettings}
        style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }, savingSettings && { opacity: 0.6 }]}
      >
        {savingSettings ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>Salva</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 18 },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: -12 },
  group: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cta: {
    backgroundColor: colors.primary, minHeight: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
