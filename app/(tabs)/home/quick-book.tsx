import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { BookingForm } from '../../../src/components/booking/BookingForm';
import { BlockForm } from '../../../src/components/booking/BlockForm';
import { SheetCloseButton } from '../../../src/components/SheetScaffold';
import { ClaySegmented } from '../../../src/components/clay';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../../src/utils/motion';

type Mode = 'lesson' | 'block';

/* ───────── Quick-book sheet ─────────
 * Si apre dal buco libero della vista Giorno o dal blocco fantasma della
 * Settimana. Ospita gli STESSI moduli delle route dedicate — <BookingForm> /
 * <BlockForm>, incorporati — sotto il segmentato clay (REG-639). Il genitore
 * (IstruttoreHomeScreen) riempie bookingSheetStore + blockSheetStore con
 * l'orario. I due moduli si scambiano in dissolvenza. */
export default function QuickBookScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('lesson');

  return (
    <View style={s.root}>
      <View style={s.topbar}>
        <ClaySegmented
          options={[
            { value: 'lesson', label: 'Prenota guida', testID: 'quick-book-lesson' },
            { value: 'block', label: 'Blocca orario', testID: 'quick-book-block' },
          ]}
          value={mode}
          onChange={setMode}
          style={s.seg}
        />
        <SheetCloseButton onPress={() => router.back()} />
      </View>

      <Animated.View key={mode} entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={s.body}>
        {mode === 'lesson' ? <BookingForm embedded /> : <BlockForm embedded />}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  // Page sheet (PAGE_SHEET): i moduli incorporati scorrono e fissano la CTA in fondo.
  root: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 22 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingBottom: 14 },
  seg: { flex: 1 },
  body: { flex: 1 },
});
