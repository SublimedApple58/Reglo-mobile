import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayList, ClayListRow } from '../../../src/components/clay';
import { instructorPickerStore } from '../../../src/stores/instructorPickerStore';
import { regloApi } from '../../../src/services/regloApi';
import type { AutoscuolaInstructor } from '../../../src/types/regloApi';
import { CLAY } from '../../../src/theme/clay';

/**
 * «Cambia istruttore» — form sheet unico (FORM_SHEET + FormSheet, REG-639
 * clay). Gli istruttori sono righe di una lista clay dentro il foglio (scorre
 * da sé), spunta nera su quello scelto. Tap → applica e chiude.
 */
export default function ManageLessonInstructorScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(instructorPickerStore.subscribe, instructorPickerStore.get);

  const [list, setList] = useState<AutoscuolaInstructor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    regloApi
      .getInstructors()
      .then((items) => { if (!cancelled) setList(items ?? []); })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const active = list.filter((it) => it.status !== 'inactive');

  const pick = (it: AutoscuolaInstructor) => {
    data?.onSelect(it);
    router.back();
  };

  const state = loading && list.length === 0 ? 'loading' : active.length === 0 ? 'empty' : 'list';

  return (
    <FormSheet
      title="Cambia istruttore"
      subtitle="Scegli chi terrà questa guida."
      contentKey={state}
      testID="manage-lesson-instructor-sheet"
    >
      {state === 'loading' ? (
        <View style={s.center}>
          <ActivityIndicator size="small" color={CLAY.ink} />
          <Text style={s.muted}>Carico gli istruttori…</Text>
        </View>
      ) : state === 'empty' ? (
        <View style={s.center}><Text style={s.muted}>Nessun istruttore disponibile.</Text></View>
      ) : (
        <ClayList>
          {active.map((it) => {
            const isCurrent = it.id === data?.currentInstructorId;
            const isSelected = it.id === data?.selectedInstructorId;
            return (
              <ClayListRow
                key={it.id}
                title={it.name}
                subtitle={isCurrent ? 'Istruttore attuale' : undefined}
                trailing={isSelected ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : null}
                chevron={false}
                onPress={() => pick(it)}
                testID={`instructor-option-${it.id}`}
              />
            );
          })}
        </ClayList>
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  muted: { color: CLAY.ink3, fontSize: 14 },
});
