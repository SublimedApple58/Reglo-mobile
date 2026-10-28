import React, { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import RangesEditor from '../../../src/components/RangesEditor';
import { ClayButton, ClayList, ClayListRow, ClaySection, ClayToggle } from '../../../src/components/clay';
import { publishDayStore } from '../../../src/stores/publishDayStore';
import { TimeRange } from '../../../src/types/regloApi';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../../src/utils/motion';

const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];

const minutesToDate = (m: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

/**
 * Orari di un giorno (settimana tipo o giorno della settimana pubblicata) —
 * REG-639 clay: form sheet unico; «Disponibile» è una riga con interruttore,
 * le fasce compaiono sotto in dissolvenza, «Salva» è la CTA in fondo.
 */
export default function PublishDayScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(publishDayStore.subscribe, publishDayStore.get);

  const [available, setAvailable] = useState<boolean>(data?.available ?? false);
  const [ranges, setRanges] = useState<TimeRange[]>(
    data?.ranges && data.ranges.length ? data.ranges : [...DEFAULT_RANGES],
  );

  if (!data) return <View style={s.empty} />;

  const handlePickTime = (index: number, field: 'start' | 'end') => {
    const range = ranges[index];
    if (!range) return;
    const mins = field === 'start' ? range.startMinutes : range.endMinutes;
    const key = field === 'start' ? 'startMinutes' : 'endMinutes';
    data.openTimePicker(minutesToDate(mins), (d) => {
      const m = d.getHours() * 60 + d.getMinutes();
      setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: m } : r)));
    });
  };

  const handleSave = () => {
    data.onSave(available, available ? ranges : []);
    router.back();
  };

  return (
    <FormSheet
      title={data.dayLabel}
      subtitle="Scegli i tuoi orari per questo giorno."
      testID="publish-day-sheet"
      cta={<ClayButton title="Salva" onPress={handleSave} testID="publish-day-save" />}
    >
      <ClayList>
        <ClayListRow
          title="Disponibile"
          subtitle={available ? 'Gli allievi possono prenotare' : 'Giorno di riposo'}
          trailing={<ClayToggle value={available} onValueChange={setAvailable} accessibilityLabel="Disponibile" testID="publish-day-available" />}
        />
      </ClayList>

      {available ? (
        <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
          <ClaySection title="Fasce orarie">
            <RangesEditor
              ranges={ranges}
              onChange={setRanges}
              onPickTime={handlePickTime}
              onAddRange={() => setRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }])}
            />
          </ClaySection>
        </Animated.View>
      ) : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
});
