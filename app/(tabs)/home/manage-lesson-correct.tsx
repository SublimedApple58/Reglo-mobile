import React, { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { correctOutcomeStore } from '../../../src/stores/correctOutcomeStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayList, ClayListRow } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';

/**
 * «Correggi l'esito» di una guida passata — form sheet unico (FORM_SHEET +
 * FormSheet, REG-639 clay): le due risposte sono righe di una lista clay, la
 * spunta nera marca l'esito attuale. Tap su un'opzione → chiude questo foglio +
 * "Gestisci guida" (dismiss(2)) e applica.
 */
export default function ManageLessonCorrectScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(correctOutcomeStore.subscribe, correctOutcomeStore.get);

  React.useEffect(() => () => correctOutcomeStore.clear(), []);

  if (!data) return <View style={s.empty} />;

  const pick = (action: 'checked_in' | 'no_show') => {
    const cb = data.onPick;
    router.dismiss(2); // chiude il form sheet + "Gestisci guida" → torna all'agenda
    setTimeout(() => cb(action), 260);
  };

  const current = data.currentOutcome;
  const check = (action: 'checked_in' | 'no_show') =>
    current === action ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : null;

  return (
    <FormSheet title="Correggi l'esito" testID="manage-lesson-correct-sheet">
      <ClayList>
        <ClayListRow
          title="Presente"
          subtitle={current === 'checked_in' ? 'Esito attuale' : undefined}
          trailing={check('checked_in')}
          chevron={false}
          onPress={() => pick('checked_in')}
          testID="correct-outcome-presente"
        />
        <ClayListRow
          title="Assente"
          subtitle={current === 'no_show' ? 'Esito attuale' : undefined}
          trailing={check('no_show')}
          chevron={false}
          onPress={() => pick('no_show')}
          testID="correct-outcome-assente"
        />
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
});
