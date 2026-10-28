import React, { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList } from '../../../src/components/clay';
import { SettingToggleRow } from '../../../src/components/SettingsRows';
import { clusterSettingsStore } from '../../../src/stores/clusterSettingsStore';

/** «Funzionalità extra» del gruppo (REG-639): form sheet clay, tre interruttori. */
export default function ExtrasScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(clusterSettingsStore.subscribe, clusterSettingsStore.get);
  if (!data) return <View style={s.empty} />;

  const {
    companyDefaults: cd,
    swapEnabled, setSwapEnabled,
    studentCancellationEnabled, setStudentCancellationEnabled,
    weeklyAbsenceEnabled, setWeeklyAbsenceEnabled,
    saving, onSave,
  } = data;

  return (
    <FormSheet
      title="Funzionalità extra"
      subtitle="Cosa possono fare i tuoi allievi"
      busy={saving}
      testID="extras-sheet"
      cta={
        <ClayButton
          title="Salva"
          loading={saving}
          onPress={saving ? undefined : async () => { await onSave(); router.back(); }}
          testID="extras-save"
        />
      }
    >
      <ClayList>
        <SettingToggleRow title="Scambio guide" subtitle="Gli allievi si propongono scambi di orario" value={swapEnabled ?? cd.swapEnabled} onValueChange={setSwapEnabled} />
        <SettingToggleRow title="Annullamento guide" subtitle="Gli allievi annullano da soli le loro guide" value={studentCancellationEnabled ?? cd.studentCancellationEnabled} onValueChange={setStudentCancellationEnabled} />
        <SettingToggleRow title="Assenza settimanale" subtitle="Gli allievi segnalano una settimana in cui non ci sono" value={weeklyAbsenceEnabled ?? cd.weeklyAbsenceEnabled} onValueChange={setWeeklyAbsenceEnabled} />
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
});
