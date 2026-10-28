import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClaySurface, Icon3D } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme';
import { useRouter } from 'expo-router';

import * as Haptics from '../../../src/utils/haptics';
import { car34Art, ROAD_ASSETS } from '../../../src/road/markerArt';
import { formatRange } from '../../../src/road/format';
import { lessonStudentName } from '../../../src/road/roadStore';
import { dismissInvite } from '../../../src/road/roadActions';
import {
  SHEET_HANDOFF_MS,
  beginRoadEntry,
  roadEntryStore,
  roadInviteOpen,
} from '../../../src/road/entryFlow';

/**
 * REG-638 — «Entri in modalità Road?». Form sheet nativo aperto da
 * RoadController quando una guida dell'istruttore è nella finestra d'ingresso.
 */
export default function RoadInviteSheet() {
  const router = useRouter();
  const live = useSyncExternalStore(roadEntryStore.subscribe, roadEntryStore.get);
  // Snapshot al mount: il seed può essere riscritto mentre il foglio si chiude.
  const [seed] = useState(() => live);

  useEffect(() => {
    roadInviteOpen.current = true;
    return () => {
      roadInviteOpen.current = false;
    };
  }, []);

  if (!seed) return <View style={s.root} />;
  const { lesson, locationName } = seed;
  const meta = [formatRange(lesson.startsAt, lesson.endsAt), lesson.vehicle?.name ?? null].filter(Boolean).join(' · ');

  const onEnter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    router.back();
    setTimeout(() => void beginRoadEntry(router, lesson), SHEET_HANDOFF_MS);
  };

  const onLater = () => {
    void dismissInvite(lesson.appointmentId);
    router.back();
  };

  return (
    <FormSheet
      title={'Entri in modalità Road?'}
      subtitle={'È l\'ora della guida.'}
      testID="road-invite"
      cta={
        <>
      <View style={s.stack}>
        <ClayButton title="Entra in Road" onPress={onEnter} testID="road-invite-enter" />
        <ClayButton variant="secondary" title="Non ora" onPress={onLater} testID="road-invite-later" />
      </View>
        </>
      }
    >

      <ClaySurface padded={false} radius={24} style={s.hero}>
        <Icon3D source={car34Art(lesson.carColor)} size={62} width={76} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.heroName} numberOfLines={1}>{lessonStudentName(lesson)}</Text>
          <Text style={s.heroMeta} numberOfLines={1}>{meta}</Text>
          {locationName ? (
            <Text style={s.heroMeta} numberOfLines={1}>Partenza da {locationName}</Text>
          ) : null}
        </View>
      </ClaySurface>

      <View style={s.features}>
        <View style={s.feature}>
          <Image source={ROAD_ASSETS.pin} style={s.featureImg} resizeMode="contain" />
          <Text style={s.featureTx}>Percorso registrato mentre guidate</Text>
        </View>
        <View style={s.feature}>
          <Image source={ROAD_ASSETS.stop} style={s.featureImg} resizeMode="contain" />
          <Text style={s.featureTx}>Segnali gli errori sul punto esatto</Text>
        </View>
        <View style={s.feature}>
          <Image source={ROAD_ASSETS.memo} style={s.featureImg} resizeMode="contain" />
          <Text style={s.featureTx}>Pagellino a portata di mano</Text>
        </View>
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: CLAY.bg },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, padding: 14 },
  heroName: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  heroMeta: { fontSize: 14, fontWeight: '400', color: CLAY.ink3, marginTop: 3 },
  features: { marginTop: 20, marginHorizontal: 2, gap: 14, marginBottom: 4 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureImg: { width: 32, height: 32 },
  featureTx: { flex: 1, fontSize: 15, fontWeight: '400', color: CLAY.ink2, letterSpacing: -0.15 },
  stack: { gap: 12 },
});
