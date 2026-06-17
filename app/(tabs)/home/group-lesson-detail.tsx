import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { groupLessonStudentStore } from '../../../src/stores/groupLessonStudentStore';
import { regloApi } from '../../../src/services/regloApi';
import { formatDay, formatTime } from '../../../src/utils/date';
import { SkeletonBlock } from '../../../src/components/Skeleton';
import type { GroupLesson } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { SheetScaffold } from '../../../src/components/SheetScaffold';

const FADE_MS = 320;

const durationOf = (startIso: string, endIso: string | null) => {
  if (!endIso) return 180;
  return Math.max(60, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
};

/**
 * Fixed-height slot: shows a shimmer placeholder until `ready`, then cross-fades
 * the real value in. The fixed height keeps the layout (and the form-sheet
 * detent) stable so data appears as a soft dissolve, never a jump.
 */
function Slot({
  ready,
  height,
  skWidth,
  skHeight,
  skRadius = 8,
  center,
  children,
}: {
  ready: boolean;
  height: number;
  skWidth: number;
  skHeight: number;
  skRadius?: number;
  center?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ height, justifyContent: 'center', alignItems: center ? 'center' : 'flex-start' }}>
      {ready ? (
        <Animated.View entering={FadeIn.duration(FADE_MS)}>{children}</Animated.View>
      ) : (
        <SkeletonBlock width={skWidth} height={skHeight} radius={skRadius} />
      )}
    </View>
  );
}

export default function GroupLessonDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const seed = useSyncExternalStore(groupLessonStudentStore.subscribe, groupLessonStudentStore.get);

  const [lesson, setLesson] = useState<GroupLesson | null>(null);
  const [busy, setBusy] = useState(false);
  const groupLessonId = seed?.groupLessonId ?? null;

  const reload = useCallback(async () => {
    if (!groupLessonId) return;
    try {
      const res = await regloApi.getGroupLesson(groupLessonId);
      setLesson(res ?? null);
    } catch {
      // keep whatever is on screen
    }
  }, [groupLessonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Tell the parent when this route is dismissed, then clear the store.
  useEffect(() => {
    return () => {
      groupLessonStudentStore.get()?.onClosed?.();
      groupLessonStudentStore.clear();
    };
  }, []);

  if (!seed || !groupLessonId) {
    return <View style={s.sheet} />;
  }

  const ready = !!lesson;
  const filled = lesson?.filledSeats ?? 0;
  const capacity = lesson?.capacity ?? 3;
  const durationMin = lesson ? durationOf(lesson.startsAt, lesson.endsAt) : 180;
  const vehicleName = lesson?.vehicleName ?? null;
  const instructorName = lesson?.instructorName ?? 'Da assegnare';
  // Show the vehicle row while loading (most lessons have one) and after load
  // only if there's actually a vehicle.
  const showVehicleRow = !ready || !!vehicleName;

  // Late withdrawal warning (shown only in the confirm dialog): a group-lesson
  // seat is always "da pagare", so a late withdrawal can be charged.
  const isLate =
    !!lesson &&
    seed.cutoffHours > 0 &&
    Date.now() >= new Date(lesson.startsAt).getTime() - seed.cutoffHours * 60 * 60 * 1000;

  const doWithdraw = async () => {
    setBusy(true);
    try {
      const res = await regloApi.withdrawFromGroupLesson(groupLessonId);
      if (res && typeof res === 'object' && 'success' in res && (res as { success: boolean }).success === false) {
        throw new Error((res as { message?: string }).message ?? 'Operazione non riuscita.');
      }
      seed.onChanged?.();
      router.back();
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const confirmWithdraw = () => {
    Alert.alert(
      'Ritirarti dalla guida di gruppo?',
      isLate
        ? `Mancano meno di ${seed.cutoffHours} ore alla guida. Ritirandoti, la guida potrebbe esserti comunque addebitata.`
        : 'Il tuo posto verrà liberato e offerto agli altri allievi.',
      [
        { text: 'Indietro', style: 'cancel' },
        { text: 'Ritira iscrizione', style: 'destructive', onPress: doWithdraw },
      ],
    );
  };

  return (
    <View style={[s.sheet, Platform.OS === 'android' && { flex: 1 }]}>
      {/* Top action bar — X close */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <SheetScaffold
        contentContainerStyle={s.content}
        footer={
          /* Ritiro */
          <Pressable
            onPress={confirmWithdraw}
            disabled={!ready || busy}
            style={({ pressed }) => [s.withdrawPill, { width: 'auto', marginTop: 28, marginHorizontal: 20, marginBottom: insets.bottom + 16 }, (pressed || busy || !ready) && { opacity: 0.85 }]}
            accessibilityLabel="Ritira iscrizione"
          >
            {busy ? (
              <ActivityIndicator color="#E5484D" />
            ) : (
              <>
                <MaterialCommunityIcons name="exit-run" size={20} color="#E5484D" />
                <Text style={s.withdrawText}>Ritira iscrizione</Text>
              </>
            )}
          </Pressable>
        }
      >
        {/* Hero — giorno + orario in risalto */}
        <View style={s.hero}>
          <Text style={s.kicker}>Guida di gruppo</Text>
          <Slot ready={ready} height={36} skWidth={168} skHeight={30} skRadius={9}>
            <Text style={s.heroClock}>
              {lesson ? `${formatTime(lesson.startsAt)}${lesson.endsAt ? ` – ${formatTime(lesson.endsAt)}` : ''}` : ''}
            </Text>
          </Slot>
          <Slot ready={ready} height={20} skWidth={134} skHeight={13}>
            <Text style={s.heroDay}>
              {lesson ? `${formatDay(lesson.startsAt)} · ${durationMin} min` : ''}
            </Text>
          </Slot>
        </View>

        {/* Posti — pallini anonimi (nessun nome degli altri allievi) */}
        <View style={s.seatsBlock}>
          <View style={s.seatsRow}>
            {Array.from({ length: capacity }).map((_, i) =>
              ready ? (
                <Animated.View
                  key={i}
                  entering={FadeIn.duration(FADE_MS)}
                  style={[s.seatBig, i >= filled && s.seatBigEmpty]}
                >
                  {i < filled ? <Ionicons name="person" size={20} color="#0F766E" /> : null}
                </Animated.View>
              ) : (
                <SkeletonBlock key={i} width={46} height={46} radius={16} />
              ),
            )}
          </View>
          <Slot ready={ready} height={18} skWidth={132} skHeight={12} center>
            <Text style={s.seatsCaption}>{filled} su {capacity} posti occupati</Text>
          </Slot>
        </View>

        {/* Istruttore + Veicolo — righe piatte, sola lettura */}
        <View style={s.detailRows}>
          <View style={s.detailRow}>
            <View style={s.detailIcon}><Ionicons name="person-outline" size={23} color="#1A1A2E" /></View>
            <View style={s.detailBody}>
              <Text style={s.detailLabel}>Istruttore</Text>
              <Slot ready={ready} height={19} skWidth={150} skHeight={13}>
                <Text style={s.detailValue} numberOfLines={1}>{instructorName}</Text>
              </Slot>
            </View>
          </View>
          {showVehicleRow ? (
            <>
              <View style={s.rowDivider} />
              <View style={s.detailRow}>
                <View style={s.detailIcon}><MaterialCommunityIcons name="car-outline" size={24} color="#1A1A2E" /></View>
                <View style={s.detailBody}>
                  <Text style={s.detailLabel}>Veicolo</Text>
                  <Slot ready={ready} height={19} skWidth={120} skHeight={13}>
                    <Text style={s.detailValue} numberOfLines={1}>{vehicleName}</Text>
                  </Slot>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFEFF1', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 24 },

  // Hero — giorno + orario in risalto
  hero: { gap: 2 },
  kicker: { fontSize: 12, fontWeight: '600', color: '#6E7596', letterSpacing: 0.3, marginBottom: 4 },
  heroClock: { fontSize: 30, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.8, lineHeight: 34 },
  heroDay: { fontSize: 15, fontWeight: '500', color: '#717171' },

  // Posti — pallini grandi
  seatsBlock: { alignItems: 'center', gap: 12, paddingVertical: 4 },
  seatsRow: { flexDirection: 'row', gap: 12 },
  seatBig: {
    width: 46, height: 46, borderRadius: 16, backgroundColor: '#E3F4EC',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0F9E7A', shadowOpacity: 0.38, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 7,
  },
  seatBigEmpty: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#1A1A2E', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  seatsCaption: { fontSize: 13, fontWeight: '500', color: '#6E7596' },

  // Righe piatte istruttore/veicolo (sola lettura)
  detailRows: { gap: 0 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  detailIcon: { width: 28, alignItems: 'center' },
  detailBody: { flex: 1, gap: 2 },
  detailLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  detailValue: { fontSize: 14, fontWeight: '400', color: '#717171' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEBEB', marginLeft: 44 },

  // Ritiro
  withdrawPill: {
    marginTop: 4, width: '100%', height: 54, borderRadius: 27, backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#F1D5D6',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  withdrawText: { fontSize: 15.5, fontWeight: '600', color: '#E5484D', letterSpacing: -0.2 },
});
