import React, { useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { homeAddSheetStore } from '../../../src/stores/homeAddSheetStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayList, ClayListRow } from '../../../src/components/clay';

/**
 * Foglio «Nuovo» del «+» dell'Agenda (REG-639 clay, notte 28/10): il form sheet
 * unico, voci di solo testo (titolo + una riga che spiega), niente icone
 * (§0.4: dove bastano testo e gerarchia l'icona non si mette). Al tocco chiude
 * e lancia l'azione a foglio chiuso (iOS), mai due fogli in animazione insieme.
 */
export default function AddActionScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(homeAddSheetStore.subscribe, homeAddSheetStore.get);

  const pick = (run: () => void) => {
    router.back();
    if (Platform.OS === 'ios') setTimeout(run, 380);
    else run();
  };

  if (!data) return <View style={s.empty} />;

  const rows = [
    { key: 'book', title: 'Guida', sub: 'Con un allievo, a un orario', run: data.onBook, show: data.canBook },
    { key: 'group', title: 'Guida di gruppo', sub: 'Più allievi insieme', run: data.onGroupLesson, show: data.canGroupLesson },
    { key: 'exam', title: 'Esame', sub: 'Una sessione d’esame con i tuoi allievi', run: data.onExam, show: true },
    { key: 'theory', title: 'Lezione teorica', sub: 'Occupa l’orario in agenda', run: data.onTheory, show: true },
    { key: 'block', title: 'Blocca un orario', sub: 'Nessuno può prenotarlo', run: data.onBlock, show: true },
    { key: 'sick', title: 'Malattia', sub: 'Uno o più giorni di assenza', run: data.onSick, show: true },
  ].filter((r) => r.show);

  return (
    <FormSheet title="Nuovo" testID="add-action-sheet">
      <ClayList>
        {rows.map((r) => (
          <ClayListRow key={r.key} title={r.title} subtitle={r.sub} onPress={() => pick(r.run)} testID={`add-${r.key}`} />
        ))}
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({ empty: { backgroundColor: '#FFFFFF', height: 1 } });
