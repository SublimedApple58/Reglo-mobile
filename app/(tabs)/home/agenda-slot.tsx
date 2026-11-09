import React, { useCallback, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayList, ClayListRow, markClayRow } from '../../../src/components/clay';
import { agendaSlotSheetStore, type AgendaSlotRow } from '../../../src/stores/agendaSlotSheetStore';
import * as Haptics from '../../../src/utils/haptics';

/**
 * La cella «+N» della griglia settimanale (09/11/2026): tutti gli impegni di
 * una fascia affollata, uno per riga con il volto dell'istruttore. Il tocco
 * chiude il foglio e poi (iOS, a foglio chiuso) apre l'impegno. Righe memo
 * nella FlatList del foglio; nessuna chiamata di rete.
 */
export default function AgendaSlotSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(agendaSlotSheetStore.subscribe, agendaSlotSheetStore.get);

  const pick = useCallback(
    (key: string) => {
      const current = agendaSlotSheetStore.get();
      if (!current) return;
      Haptics.selectionAsync().catch(() => undefined);
      router.back();
      if (Platform.OS === 'ios') setTimeout(() => current.onPick(key), 380);
      else current.onPick(key);
    },
    [router],
  );

  if (!data) return <View style={s.blank} />;

  return (
    <FormSheet
      title={data.title}
      subtitle={data.subtitle}
      testID="agenda-slot-sheet"
      list={{
        data: [data.rows],
        keyExtractor: () => 'rows',
        renderItem: ({ item }: { item: AgendaSlotRow[] }) => (
          <ClayList>
            {item.map((r) => (
              <SlotRow key={r.key} row={r} onPick={pick} />
            ))}
          </ClayList>
        ),
      }}
    />
  );
}

const SlotRow = markClayRow(
  React.memo(function SlotRow({
    row,
    onPick,
    divider,
    first,
    last,
  }: {
    row: AgendaSlotRow;
    onPick: (key: string) => void;
    divider?: boolean;
    first?: boolean;
    last?: boolean;
  }) {
    return (
      <ClayListRow
        divider={divider}
        first={first}
        last={last}
        leading={<Avatar userId={row.instructorUserId} name={row.instructorName} size={42} />}
        title={row.instructorName}
        subtitle={row.detail}
        onPress={() => onPick(row.key)}
        testID="agenda-slot-row"
      />
    );
  }),
);

const s = StyleSheet.create({
  blank: { backgroundColor: '#FFFFFF', height: 1 },
});
