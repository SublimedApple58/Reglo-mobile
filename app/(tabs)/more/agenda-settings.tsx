import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClaySegmented } from '../../../src/components/clay';
import { instructorSettingsStore } from '../../../src/stores/instructorSettingsStore';
import { CLAY } from '../../../src/theme/clay';

const weekPresets = [2, 4, 6, 8, 12] as const;
const reminderOptions = [120, 60, 30, 20, 15] as const;
const toReminderLabel = (m: number) => (m === 120 ? '2h' : `${m}m`);

/**
 * Opzioni del segmentato: i valori pronti più, se diverso, quello salvato
 * (es. 3 settimane impostate dal web), così il cursore non mente mai.
 */
const withCurrent = (presets: readonly number[], current: string) => {
  const n = Number(current);
  const values = Number.isFinite(n) && n > 0 && !presets.includes(n) ? [...presets, n] : [...presets];
  return values.sort((a, b) => a - b);
};

/**
 * Agenda (titolare) — REG-639 clay: il form sheet unico. Settimane
 * prenotabili e promemoria come segmentati clay (al posto dei chip), «Salva»
 * è la CTA in fondo.
 */
export default function AgendaSettingsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(instructorSettingsStore.subscribe, instructorSettingsStore.get);
  if (!data) return <View style={s.empty} />;

  const {
    availabilityWeeks, setAvailabilityWeeks,
    studentReminderMinutes, setStudentReminderMinutes,
    instructorReminderMinutes, setInstructorReminderMinutes,
    savingSettings, onSaveOwnerSettings,
  } = data;

  return (
    <FormSheet
      title="Agenda"
      subtitle="Finestra di prenotazione e promemoria."
      testID="agenda-settings-sheet"
      cta={
        <ClayButton
          title="Salva"
          onPress={() => { onSaveOwnerSettings(); router.back(); }}
          loading={savingSettings}
          testID="agenda-settings-save"
        />
      }
    >
      <Text style={s.label}>Settimane prenotabili</Text>
      <ClaySegmented
        options={withCurrent(weekPresets, availabilityWeeks).map((w) => ({ value: String(w), label: String(w) }))}
        value={availabilityWeeks}
        onChange={setAvailabilityWeeks}
        testID="agenda-settings-weeks"
      />

      <Text style={[s.label, s.gap]}>Promemoria allievo</Text>
      <ClaySegmented
        options={withCurrent(reminderOptions, studentReminderMinutes)
          .sort((a, b) => b - a)
          .map((m) => ({ value: String(m), label: toReminderLabel(m) }))}
        value={studentReminderMinutes}
        onChange={setStudentReminderMinutes}
        testID="agenda-settings-student-reminder"
      />

      <Text style={[s.label, s.gap]}>Promemoria istruttore</Text>
      <ClaySegmented
        options={withCurrent(reminderOptions, instructorReminderMinutes)
          .sort((a, b) => b - a)
          .map((m) => ({ value: String(m), label: toReminderLabel(m) }))}
        value={instructorReminderMinutes}
        onChange={setInstructorReminderMinutes}
        testID="agenda-settings-instructor-reminder"
      />
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  label: { fontSize: 15, fontWeight: '500', color: CLAY.ink, marginBottom: 8, paddingHorizontal: 2 },
  gap: { marginTop: 22 },
});
