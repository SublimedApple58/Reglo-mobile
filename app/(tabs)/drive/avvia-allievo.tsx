import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { CLAY } from '../../../src/theme';
import { ClayButton, ClayList, ClayListRow, ClaySurface, PlayGlyph } from '../../../src/components/clay';
import { BriefingRows, RouteThumb } from '../../../src/components/road/RoadTabParts';
import { RoadPlanRow } from '../../../src/components/road/RoadPlanCard';
import { SkeletonBlock } from '../../../src/components/Skeleton';
import { ROAD_FADE_IN, ROAD_FADE_OUT } from '../../../src/road/motion';
import { beginRoadEntry, SHEET_HANDOFF_MS } from '../../../src/road/entryFlow';
import { lessonMinutes } from '../../../src/road/planStore';
import { openRoadPercorso } from '../../../src/road/openRoadPercorso';
import { dayLabel, formatKm, formatMinutes, formatRange } from '../../../src/road/format';
import { lessonStudentName } from '../../../src/road/roadStore';
import { firstName, useAvvioData, usePerson } from '../../../src/road/avvioParts';
import { AVVIO_PARTI_ROUTE, avvioStore, hasRoadHistory, useRoadStudent } from '../../../src/road/avvioFlow';

/**
 * REG-662 (piano 005) — avvio guida, foglio 2 di 3: «<Nome> su Road».
 * In breve le cose Road dell'allievo prima di partire: come sono andate le
 * ultime guide (briefing), l'ultima guida e il giro proposto con «Segui il
 * giro». Spinto sopra «Con chi guidi?»: trascinando giù si torna lì, la X
 * chiude tutto. Con la guida in agenda (home «Entra in Road») è l'unico
 * foglio e la CTA entra in Road su quella.
 */
export default function AvviaAllievoSheet() {
  const router = useRouter();
  const choice = useSyncExternalStore(avvioStore.subscribe, avvioStore.get);
  const lesson = choice.lesson;
  const studentId = lesson?.student?.id ?? choice.studentId;
  const data = useAvvioData();
  const person = usePerson(studentId, data);
  const road = useRoadStudent(studentId);
  const name = lesson ? lessonStudentName(lesson) : person?.name ?? 'Allievo';
  const first = firstName(name);
  const duration = lesson ? lessonMinutes(lesson) : data.options?.defaultDuration ?? 60;

  const subtitle = lesson
    ? ['In agenda', formatRange(lesson.startsAt, lesson.endsAt), lesson.vehicle?.name ?? null].filter(Boolean).join(' · ')
    : person?.suggestion?.reason ?? person?.detail ?? ' ';

  const closeAll = () => router.dismissAll();
  const onContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (lesson) {
      // Come l'invito: si chiude il foglio, poi si entra (informativa al primo ingresso).
      router.dismissAll();
      setTimeout(() => void beginRoadEntry(router, lesson), SHEET_HANDOFF_MS);
      return;
    }
    router.push(AVVIO_PARTI_ROUTE as never);
  };

  const last = road?.items[0] ?? null;
  const lastLine = last
    ? [last.startedAt ? dayLabel(last.startedAt) : null, `${formatKm(last.distanceMeters)} km`, `${formatMinutes(last.durationSec)} min`]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <FormSheet
      title={`${first} su Road`}
      subtitle={subtitle}
      onClose={closeAll}
      testID="road-avvio-allievo"
      cta={
        <ClayButton
          title={lesson ? 'Entra in Road' : 'Continua'}
          leading={lesson ? <PlayGlyph /> : null}
          onPress={onContinue}
          testID="road-avvio-continua"
        />
      }
    >
      {road === undefined ? (
        // Stessa forma del contenuto: il foglio non cambia altezza all'arrivo.
        <Animated.View exiting={ROAD_FADE_OUT} testID="road-avvio-skeleton">
          <ClaySurface style={s.card}>
            <SkeletonBlock width="45%" height={15} radius={6} />
            {[0, 1].map((i) => (
              <View key={i} style={s.skRow}>
                <SkeletonBlock width={36} height={36} radius={10} />
                <SkeletonBlock width="60%" height={14} radius={6} />
              </View>
            ))}
          </ClaySurface>
        </Animated.View>
      ) : !hasRoadHistory(road) ? (
        <Animated.Text entering={ROAD_FADE_IN} style={s.first}>
          Prima guida in Road con {first}.
        </Animated.Text>
      ) : (
        <Animated.View entering={ROAD_FADE_IN}>
          {road?.briefing?.lines.length ? (
            <ClaySurface style={s.card}>
              <Text style={s.cardTitle}>{road.briefing.title}</Text>
              <BriefingRows lines={road.briefing.lines} />
            </ClaySurface>
          ) : null}
          {last ? (
            <ClayList style={s.gap}>
              <ClayListRow
                leading={<RouteThumb thumb={last.thumb} size={52} carColor={null} />}
                title="Ultima guida"
                subtitle={lastLine}
                onPress={() => void openRoadPercorso(router, 'drive', last.appointmentId)}
                testID="road-avvio-ultima"
              />
            </ClayList>
          ) : null}
        </Animated.View>
      )}

      {/* REG-669: la riga con la miniatura; senza guida in agenda è sola anteprima. */}
      <RoadPlanRow studentId={studentId} durationMin={duration} style={s.gap} testID="road-avvio-plan" />
    </FormSheet>
  );
}

const s = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, borderRadius: 26 },
  cardTitle: { fontSize: 15.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2, marginBottom: 2 },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  gap: { marginTop: 12 },
  first: { fontSize: 15.5, color: CLAY.ink3, lineHeight: 21 },
});
