import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayPressable } from '../../../src/components/clay';
import { SessionNumbers } from '../../../src/components/road/RoadTabParts';
import { CLAY } from '../../../src/theme';
import { formatRange } from '../../../src/road/format';
import { lessonStudentName } from '../../../src/road/roadStore';
import { openRoadPagellino } from '../../../src/road/pagellino';
import { roadFreeStore } from '../../../src/road/freeStartStore';
import { SHEET_HANDOFF_MS } from '../../../src/road/entryFlow';

/**
 * «Appena finita» (Tiziano 28/10/2026): la guida appena chiusa col pagellino
 * da compilare. Si apre da sola sulla tab Road una volta per avvio dell'app
 * (`pagellinoPrompt`), così nella tab resta una sola CTA primaria («Parti
 * con»). Form sheet unico: niente maniglia, si chiude con la X o «Più tardi».
 */
export default function RoadAppenaFinitaSheet() {
  const router = useRouter();
  // Fotografia all'apertura: il foglio non cambia sotto le dita se la tab ricarica.
  const [seed] = useState(() => {
    const o = roadFreeStore.get();
    const id = o?.toClose?.sessionId;
    return (id && o?.recentSessions?.find((r) => r.id === id)) || null;
  });

  if (!seed) {
    // Niente da mostrare (dati cambiati nel frattempo): il foglio si richiude.
    setTimeout(() => router.back(), 0);
    return null;
  }

  const onCompile = () => {
    router.back();
    // Un foglio alla volta: il pagellino si presenta dopo la chiusura di questo.
    setTimeout(
      () => openRoadPagellino(router, seed.lesson, { showStayChip: false }, '/(tabs)/drive/pagellino'),
      SHEET_HANDOFF_MS,
    );
  };

  return (
    <FormSheet
      testID="road-appena-finita"
      title={
        <View>
          <Text style={s.kicker}>Appena finita · {formatRange(seed.lesson.startsAt, seed.endedAt ?? seed.lesson.endsAt)}</Text>
          <Text style={s.name} numberOfLines={2}>
            {lessonStudentName(seed.lesson)}
          </Text>
          <SessionNumbers session={seed} style={{ marginTop: 4 }} />
        </View>
      }
      cta={
        <>
          <ClayButton title="Compila il pagellino" onPress={onCompile} testID="road-tab-pagellino" />
          <ClayPressable kind="small" onPress={() => router.back()} hitSlop={8} style={s.later} testID="road-tab-later">
            <Text style={s.laterTx}>Più tardi</Text>
          </ClayPressable>
        </>
      }
    />
  );
}

const s = StyleSheet.create({
  kicker: { fontSize: 14, fontWeight: '400', color: CLAY.ink3 },
  name: { fontSize: 26, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.7, marginTop: 3 },
  later: { alignItems: 'center', paddingTop: 14, paddingBottom: 2 },
  laterTx: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink2 },
});
