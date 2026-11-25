import React, { memo, useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ClayNavBar, ClayLargeTitle, useLargeTitleScroll } from '../components/ClayLargeTitle';
import { ClayButton, ClaySurface } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { notificationEvents } from '../services/notificationEvents';
import { useStudentSwaps } from '../hooks/useStudentSwaps';
import { swapDetailStore, type SwapTakeResult } from '../stores/swapDetailStore';
import { CLAY } from '../theme/clay';
import { lessonCreditsSheetParams } from '../utils/lessonCreditsError';
import { durationWords, lessonMinutes, longDay, monthShort, timeRangeWords, weekdayWord } from '../utils/studentLessons';
import { FlatRow, HomeSection } from './allievoHome/HomeSections';
import type { AutoscuolaSwapOfferWithDetails } from '../types/regloApi';

const HERO = require('../../assets/vita/home-hero.png');
const IN = FadeIn.duration(220).reduceMotion(ReduceMotion.Never);
const OUT = FadeOut.duration(150).reduceMotion(ReduceMotion.Never);

/** «oggi», «domani», «giovedì», «tra 9 giorni». */
const whenWords = (iso: string) => {
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return 'oggi';
  if (diff === 1) return 'domani';
  if (diff < 7) return day.toLocaleDateString('it-IT', { weekday: 'long' });
  return `tra ${diff} giorni`;
};

const DateLead = memo(function DateLead({ iso }: { iso: string }) {
  return (
    <View style={s.dt}>
      <Text style={s.dtNum}>{new Date(iso).getDate()}</Text>
      <Text style={s.dtMonth}>{monthShort(iso)}</Text>
    </View>
  );
});

const offerMeta = (o: AutoscuolaSwapOfferWithDetails) =>
  [o.appointment.locationName, durationWords(lessonMinutes(o.appointment))].filter(Boolean).join(' · ') || 'Guida singola';

/**
 * REG-786 — tab «Scambi» dell'allievo (anteprima V1c approvata da Tiziano il
 * 24/11): la prima guida lasciata dai compagni in evidenza con «Prendila»,
 * le altre a righe con «Prendi», poi le richieste dell'allievo. Prendere una
 * guida chiede conferma (alert nativo): è una prenotazione vera.
 */
export function StudentSwapsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scrollY, onScroll } = useLargeTitleScroll();
  const { studentId, offers, myOffers, loading, refetch } = useStudentSwaps({ enabled: true, poll: true });
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // REG-790: si prende dal foglio di riepilogo (`swap-detail`): l'esito torna
  // al foglio, che mostra il quadratino STOP → OK o l'errore. Niente toast.
  const accept = useCallback(
    async (offerId: string): Promise<SwapTakeResult> => {
      if (!studentId) return { status: 'error', message: 'Sessione scaduta: riapri l\'app e riprova.' };
      setToast(null);
      try {
        const res = await regloApi.respondSwapOffer(offerId, { studentId, response: 'accept' });
        void refetch();
        if (res.accepted) {
          void queryClient.invalidateQueries({ queryKey: ['appointments'] }).then(() => notificationEvents.emitDataChanged());
          return { status: 'taken' };
        }
        return { status: 'error', message: "Qualcuno l'ha presa prima di te." };
      } catch (err) {
        // REG-784: crediti non bastano → il foglio dei crediti.
        const credits = lessonCreditsSheetParams(err);
        if (credits) {
          return { status: 'leave', after: () => router.push({ pathname: '/(tabs)/swaps/credits-needed', params: credits }) };
        }
        return { status: 'error', message: err instanceof Error && err.message ? err.message : 'Non è andata: riprova.' };
      }
    },
    [studentId, queryClient, refetch, router],
  );

  const revoke = useCallback(
    async (offerId: string) => {
      if (!studentId) return;
      try {
        await regloApi.cancelSwapOffer(offerId, studentId);
        setToast({ text: 'Richiesta revocata', tone: 'info' });
        notificationEvents.emitDataChanged();
        await refetch();
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : 'Errore', tone: 'danger' });
      }
    },
    [studentId, refetch],
  );

  const openOffer = (o: AutoscuolaSwapOfferWithDetails) => {
    swapDetailStore.set({ offer: o, onAccept: accept });
    router.push('/(tabs)/swaps/swap-detail');
  };
  const openMine = (o: AutoscuolaSwapOfferWithDetails) => {
    swapDetailStore.set({ offer: o, mine: true, onRevoke: revoke });
    router.push('/(tabs)/swaps/swap-detail');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const featured = offers[0] ?? null;
  const others = offers.slice(1);

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ClayNavBar title="Scambi" scrollY={scrollY} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={CLAY.ink3} />}
        testID="swaps-screen"
      >
        <ClayLargeTitle title="Scambi" />
        <Text style={s.lead}>Guide lasciate dai compagni: chi arriva prima, guida.</Text>

        {loading ? (
          <Animated.View exiting={OUT} style={s.skeleton}>
            <SkeletonBlock width="100%" height={258} radius={28} />
            <View style={s.skeletonRows}>
              <SkeletonBlock width="38%" height={16} radius={8} />
              <SkeletonBlock width="100%" height={44} radius={12} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={IN}>
            {featured ? (
              <ClaySurface padded={false} style={s.card} onPress={() => openOffer(featured)} accessibilityLabel={`Guida lasciata da un compagno, ${longDay(featured.appointment.startsAt)}`}>
                <View style={s.cover}>
                  <Image source={HERO} style={s.coverImg} resizeMode="cover" accessibilityIgnoresInvertColors />
                </View>
                <View style={s.bb}>
                  <Text style={s.when}>Lasciata da un compagno · {whenWords(featured.appointment.startsAt)}</Text>
                  <Text style={s.day}>{longDay(featured.appointment.startsAt)}</Text>
                  <Text style={s.time} numberOfLines={1}>
                    {[timeRangeWords(featured.appointment), featured.appointment.locationName].filter(Boolean).join(' · ')}
                  </Text>
                  <ClayButton
                    title="Prendila"
                    compact
                    onPress={() => openOffer(featured)}
                    style={s.cta}
                    testID="swap-take-featured"
                  />
                </View>
              </ClaySurface>
            ) : (
              <ClaySurface padded={false} style={s.card}>
                <View style={s.cover}>
                  <Image source={HERO} style={s.coverImg} resizeMode="cover" accessibilityIgnoresInvertColors />
                </View>
                <View style={[s.bb, s.center]}>
                  <Text style={[s.day, s.dayEmpty]}>Nessuna guida da prendere</Text>
                  <Text style={[s.time, s.timeEmpty]}>Quando un compagno ne lascia una, la trovi qui.</Text>
                </View>
              </ClaySurface>
            )}

            {others.length ? (
              <HomeSection title="Altre disponibili">
                {others.map((o, i) => (
                  <FlatRow
                    key={o.id}
                    first={i === 0}
                    leading={<DateLead iso={o.appointment.startsAt} />}
                    title={`${weekdayWord(o.appointment.startsAt)} · ${timeRangeWords(o.appointment)}`}
                    subtitle={offerMeta(o)}
                    onPress={() => openOffer(o)}
                    trailing={
                      <Pressable onPress={() => openOffer(o)} hitSlop={10} accessibilityRole="button" testID={`swap-take-${o.id}`}>
                        <Text style={s.take}>Prendi</Text>
                      </Pressable>
                    }
                  />
                ))}
              </HomeSection>
            ) : null}

            {myOffers.length ? (
              <HomeSection title="Le tue richieste" footer="Per lasciare una guida aprila e tocca «Cerca sostituto».">
                {myOffers.map((o, i) => (
                  <FlatRow
                    key={o.id}
                    first={i === 0}
                    leading={<DateLead iso={o.appointment.startsAt} />}
                    title={`${weekdayWord(o.appointment.startsAt)} · ${timeRangeWords(o.appointment)}`}
                    subtitle="Cerchi qualcuno che la prenda"
                    value="In attesa"
                    onPress={() => openMine(o)}
                    trailing={<View />}
                    testID={`swap-mine-${o.id}`}
                  />
                ))}
              </HomeSection>
            ) : (
              <Text style={s.foot}>Per lasciare una guida aprila e tocca «Cerca sostituto».</Text>
            )}
          </Animated.View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
  lead: { fontSize: 15.5, lineHeight: 21, color: CLAY.ink2, marginTop: 4 },
  skeleton: { marginTop: 18, gap: 14 },
  skeletonRows: { marginTop: 14, gap: 14 },
  card: { marginTop: 18 },
  cover: { height: 118, overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  coverImg: { width: '100%', height: '100%' },
  bb: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20 },
  center: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 22 },
  when: { fontSize: 13.5, color: CLAY.ink3 },
  day: { fontSize: 23, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.6, marginTop: 2 },
  dayEmpty: { fontSize: 21, textAlign: 'center' },
  time: { fontSize: 16, color: CLAY.ink2, marginTop: 3 },
  timeEmpty: { fontSize: 15, lineHeight: 21, marginTop: 6, textAlign: 'center' },
  cta: { marginTop: 16 },
  take: { fontSize: 15.5, fontWeight: '600', color: CLAY.ink, paddingVertical: 8, paddingLeft: 10, paddingRight: 2 },
  takeSpin: { paddingHorizontal: 12 },
  dt: { alignItems: 'center' },
  dtNum: { fontSize: 22, lineHeight: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  dtMonth: { fontSize: 12.5, color: CLAY.ink3 },
  foot: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 24, paddingHorizontal: 4 },
});
