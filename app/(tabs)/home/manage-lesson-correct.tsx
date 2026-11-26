import React, { useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { correctOutcomeStore } from '../../../src/stores/correctOutcomeStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayList, ClayListRow } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';

/**
 * «Correggi l'esito» di una guida passata — form sheet unico (FORM_SHEET +
 * FormSheet, REG-639 clay): le due risposte sono righe di una lista clay, la
 * spunta nera marca l'esito attuale. Tap su un'opzione → spinner sulla riga,
 * applica e ricarica l'agenda, poi chiude questo foglio + "Gestisci guida"
 * (dismiss(2)). REG-798: prima si chiudeva subito e la guida riaperta durante
 * l'attesa restava col foglio vecchio.
 */
export default function ManageLessonCorrectScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(correctOutcomeStore.subscribe, correctOutcomeStore.get);

  const [pending, setPending] = useState<'checked_in' | 'no_show' | null>(null);
  const mountedRef = useRef(true);

  React.useEffect(() => () => {
    mountedRef.current = false;
    correctOutcomeStore.clear();
  }, []);

  if (!data) return <View style={s.empty} />;

  const pick = async (action: 'checked_in' | 'no_show') => {
    if (pending) return;
    setPending(action);
    const ok = await data.onPick(action);
    if (!mountedRef.current) return;
    setPending(null);
    if (ok) router.dismiss(2); // chiude il form sheet + "Gestisci guida" → torna all'agenda
  };

  const current = data.currentOutcome;
  const check = (action: 'checked_in' | 'no_show') =>
    pending === action
      ? <ActivityIndicator size="small" color={CLAY.ink} />
      : current === action ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : null;

  return (
    <FormSheet title="Correggi l'esito" busy={pending !== null} testID="manage-lesson-correct-sheet">
      <ClayList>
        <ClayListRow
          title="Presente"
          subtitle={current === 'checked_in' ? 'Esito attuale' : undefined}
          trailing={check('checked_in')}
          chevron={false}
          onPress={() => void pick('checked_in')}
          testID="correct-outcome-presente"
        />
        <ClayListRow
          title="Assente"
          subtitle={current === 'no_show' ? 'Esito attuale' : undefined}
          trailing={check('no_show')}
          chevron={false}
          onPress={() => void pick('no_show')}
          testID="correct-outcome-assente"
        />
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
});
