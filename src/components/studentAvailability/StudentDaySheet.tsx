import React, { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../SheetScaffold';
import { ClayButton, ClayList } from '../clay';
import { SettingCheckRow, SettingToggleRow } from '../SettingsRows';
import { studentDayStore } from '../../stores/studentDayStore';
import type { StudentBandKey } from '../../types/regloApi';
import { bandHours } from '../../utils/studentAvailability';

/**
 * REG-802 — foglio di un giorno delle disponibilità dell'allievo: le tre fasce
 * con la spunta nera, «Uguale per tutti i giorni», «Fatto». Form sheet nativo
 * ad altezza adattiva, X in alto, niente maniglia. Registrato negli stack che
 * lo aprono (onboarding, Profilo) come rotta `student-day` con `FORM_SHEET`.
 */
export function StudentDaySheet() {
  const router = useRouter();
  const data = useSyncExternalStore(studentDayStore.subscribe, studentDayStore.get);
  const [selected, setSelected] = useState<StudentBandKey[]>(() => data?.selected ?? []);
  const [applyAll, setApplyAll] = useState(false);
  if (!data) return <View style={s.empty} />;

  const toggle = (key: StudentBandKey) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <FormSheet
      title={data.dayLabel}
      subtitle="Quando puoi, di solito?"
      testID="student-day-sheet"
      cta={
        <ClayButton
          title="Fatto"
          onPress={() => {
            data.onDone(
              data.bands.map((b) => b.key).filter((k) => selected.includes(k)),
              applyAll,
            );
            router.back();
          }}
          testID="student-day-done"
        />
      }
    >
      <ClayList>
        {data.bands.map((band) => (
          <SettingCheckRow
            key={band.key}
            title={band.label}
            subtitle={bandHours(band)}
            checked={selected.includes(band.key)}
            onPress={() => toggle(band.key)}
            testID={`student-day-${band.key}`}
          />
        ))}
      </ClayList>
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
