import React, { useCallback, useSyncExternalStore } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FormSheet } from '../components/SheetScaffold';
import { LessonHistoryRow } from '../components/student/LessonHistoryRow';
import { lessonHistoryStore } from '../stores/lessonHistoryStore';
import { CLAY } from '../theme/clay';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/**
 * «Tutte le guide» dal dettaglio allievo (29/10/2026): la scheda mostra le
 * ultime 5, qui l'elenco intero. Form sheet nativo con FlatList virtualizzata
 * e righe in memo (§15), righe piatte sullo sfondo. `kind=upcoming` per le
 * prossime, altrimenti lo storico. I dati arrivano già pronti dal seed.
 */
export function LessonHistorySheet() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const data = useSyncExternalStore(lessonHistoryStore.subscribe, lessonHistoryStore.get);
  const upcoming = kind === 'upcoming';
  const items = data ? (upcoming ? data.upcoming : data.past) : [];

  const renderItem = useCallback(
    ({ item, index }: { item: AutoscuolaAppointmentWithRelations; index: number }) =>
      data ? (
        <LessonHistoryRow
          appt={item}
          divider={index > 0}
          roadItem={data.roadByLesson.get(item.id)}
          saving={data.savingId === item.id}
          onDetails={data.onDetails}
          onOutcome={data.onOutcome}
          onRoad={data.onRoad}
        />
      ) : null,
    [data],
  );

  return (
    <FormSheet
      testID="lesson-history-sheet"
      title={upcoming ? 'Prossime guide' : 'Storico guide'}
      subtitle={data?.studentName ?? undefined}
      list={{
        data: items,
        keyExtractor: (a: AutoscuolaAppointmentWithRelations) => a.id,
        renderItem,
        initialNumToRender: 8,
        maxToRenderPerBatch: 6,
        windowSize: 7,
      }}
    >
      <Text style={s.count}>{items.length === 1 ? '1 guida' : `${items.length} guide`}</Text>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  count: { fontSize: 14, color: CLAY.ink3, paddingHorizontal: 18, paddingBottom: 4 },
});
