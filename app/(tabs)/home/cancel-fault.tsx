import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { cancelFaultStore, type CancelFault } from '../../../src/stores/cancelFaultStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayList, ClayListRow } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';

/**
 * REG-587 — "Di chi è l'imprevisto?", chiesto quando lo staff annulla una guida
 * oltre il limite di preavviso. Il form sheet unico (FORM_SHEET + FormSheet,
 * REG-639 clay): le due risposte sono righe di una lista clay, senza icone.
 *
 * Nessuna opzione preselezionata: dare per scontato "dell'allievo" è esattamente
 * il bug che questa schermata risolve. Tap su un'opzione → chiude questo foglio
 * + "Gestisci guida" (dismiss(2)) e annulla.
 */
export default function CancelFaultScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(cancelFaultStore.subscribe, cancelFaultStore.get);

  React.useEffect(() => () => cancelFaultStore.clear(), []);

  if (!data) return <View style={s.empty} />;

  const pick = (fault: CancelFault) => {
    const cb = data.onPick;
    router.dismiss(2); // chiude il form sheet + "Gestisci guida" → torna all'agenda
    setTimeout(() => cb(fault), 260);
  };

  // All'ora esatta di inizio "Mancano 0 min" non si puo' leggere; e con un'ora
  // o un minuto esatti il verbo va al singolare.
  const leadText =
    data.countdownMinutes < 1
      ? 'La guida sta per iniziare:'
      : `${data.countdownMinutes === 1 || data.countdownMinutes === 60 ? 'Manca' : 'Mancano'} ${data.countdownLabel} alla guida:`;

  const schoolSub =
    data.coverage === 'credit'
      ? `Nessuna penale: il credito torna a ${data.studentName}.`
      : data.coverage === 'money'
        ? `Nessuna penale: non addebitiamo nulla a ${data.studentName}.`
        : `Nessuna penale a carico di ${data.studentName}.`;

  return (
    <FormSheet
      title="Di chi è l'imprevisto?"
      subtitle={`${data.studentName} · ${data.whenLabel}`}
      testID="cancel-fault-sheet"
    >
      <Text style={s.lead}>{leadText} l&apos;annullamento è tardivo.</Text>
      <ClayList>
        <ClayListRow
          title="Dell'allievo"
          subtitle="Vale la regola del preavviso. Decide il titolare."
          onPress={() => pick('student')}
          testID="cancel-fault-student"
        />
        <ClayListRow
          title="Dell'autoscuola"
          subtitle={schoolSub}
          onPress={() => pick('school')}
          testID="cancel-fault-school"
        />
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  lead: { fontSize: 15, lineHeight: 21, color: CLAY.ink2, marginBottom: 16 },
});
