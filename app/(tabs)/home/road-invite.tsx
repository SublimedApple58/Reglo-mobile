import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from '../../../src/utils/haptics';
import { GlassCloseButton } from '../../../src/components/GlassCloseButton';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
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
  const insets = useSafeAreaInsets();
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
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <View style={s.kickRow}>
            <View style={s.liveDot} />
            <Text style={s.kick}>È l&apos;ora della guida</Text>
          </View>
          <Text style={s.title}>Entri in modalità Road?</Text>
        </View>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.x}>
            <Ionicons name="close" size={20} color="#3A3A3C" />
          </Pressable>
        </GlassCloseButton>
      </View>

      <SheetScaffold
        footer={
          <View style={[s.stack, { paddingBottom: Math.max(insets.bottom - 16, 18) }]}>
            <Pressable
              onPress={onEnter}
              style={({ pressed }) => [s.btn, s.btnDark, pressed && { opacity: 0.88 }]}
              testID="road-invite-enter"
            >
              <Text style={s.btnDarkTx}>Entra in Road</Text>
            </Pressable>
            <Pressable onPress={onLater} style={({ pressed }) => [s.btn, pressed && { opacity: 0.6 }]} testID="road-invite-later">
              <Text style={s.btnGhostTx}>Non ora</Text>
            </Pressable>
          </View>
        }
      >
        <View style={s.hero}>
          <Image source={car34Art(lesson.carColor)} style={s.heroImg} resizeMode="contain" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroName} numberOfLines={1}>{lessonStudentName(lesson)}</Text>
            <Text style={s.heroMeta} numberOfLines={1}>{meta}</Text>
            {locationName ? (
              <Text style={s.heroMeta} numberOfLines={1}>Partenza da {locationName}</Text>
            ) : null}
          </View>
        </View>

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
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: '#FFFFFF', paddingTop: 24, paddingHorizontal: 22 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kickRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E5484D',
    marginRight: 7,
    shadowColor: '#E5484D',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  kick: { fontSize: 13, fontWeight: '500', color: '#6A6A6A' },
  title: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.5, lineHeight: 28 },
  x: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    padding: 14,
    borderRadius: 24,
    backgroundColor: '#F2F2F0',
  },
  heroImg: { width: 76, height: 62 },
  heroName: { fontSize: 17, fontWeight: '600', color: '#111111', letterSpacing: -0.3 },
  heroMeta: { fontSize: 14, fontWeight: '400', color: '#6A6A6A', marginTop: 3 },
  features: { marginTop: 18, marginHorizontal: 2, gap: 14, marginBottom: 4 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureImg: { width: 30, height: 30 },
  featureTx: { flex: 1, fontSize: 15, fontWeight: '400', color: '#3A3A3C', letterSpacing: -0.15 },
  stack: { gap: 6, marginTop: 20 },
  btn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  btnDark: { backgroundColor: '#111111' },
  btnDarkTx: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.3 },
  btnGhostTx: { fontSize: 17, fontWeight: '500', color: '#111111', letterSpacing: -0.3 },
});
