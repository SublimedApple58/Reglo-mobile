import React, { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../SheetScaffold';
import { ClayButton, ClayList } from '../clay';
import { SettingToggleRow } from '../SettingsRows';
import { StudentDayChoice } from './StudentDayChoice';
import { studentDayStore } from '../../stores/studentDayStore';
import type { StudentTimeRange } from '../../types/regloApi';

/**
 * REG-802 — foglio di un giorno delle disponibilità dell'allievo: le tre fasce
 * con la spunta nera e, dal REG-813, «Un orario preciso» con le rotelle
 * (`StudentDayChoice`), poi «Uguale per tutti i giorni» e «Fatto». Form sheet
 * nativo ad altezza adattiva, X in alto, niente maniglia. Registrato negli
 * stack che lo aprono (onboarding, Profilo, Primo accesso) come rotta
 * `student-day` con `FORM_SHEET`.
 */
export function StudentDaySheet() {
  const router = useRouter();
  const data = useSyncExternalStore(studentDayStore.subscribe, studentDayStore.get);
  const [ranges, setRanges] = useState<StudentTimeRange[]>(() => data?.ranges ?? []);
  const [applyAll, setApplyAll] = useState(false);
  if (!data) return <View style={s.empty} />;

  return (
    <FormSheet
      title={data.dayLabel}
      subtitle="Quando puoi, di solito?"
      testID="student-day-sheet"
      cta={
        <ClayButton
          title="Fatto"
          onPress={() => {
            data.onDone(ranges, applyAll);
            router.back();
          }}
          testID="student-day-done"
        />
      }
    >
      <StudentDayChoice
        ranges={ranges}
        bands={data.bands}
        rules={data.rules}
        onChange={setRanges}
        testPrefix="student-day"
      />
      <ClayList style={s.gap}>
        <SettingToggleRow
          title="Uguale per tutti i giorni"
          subtitle="Copia su tutta la settimana"
          value={applyAll}
          onValueChange={setApplyAll}
          testID="student-day-all"
        />
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, backgroundColor: '#FFFFFF' },
  gap: { marginTop: 14 },
});
