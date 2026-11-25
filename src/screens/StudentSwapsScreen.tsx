import React, { memo, useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayNavBar, NAV_BAR_H } from '../components/ClayLargeTitle';
import { Avatar, ClayButton, ClaySurface, Icon3D } from '../components/clay';
import { COVER_OVERLAP, StretchyCover, StretchySpacer, stretchyPanel, useStretchyCover } from '../components/clay/StretchyCover';
import { useTabBarOverlap } from '../components/tabBarSpace';
import { swapNoticeStore } from '../stores/swapNoticeStore';
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

/** REG-789: copertina della sezione (chiavi che passano di mano, Gemini 25/11). */
const COVER = require('../../assets/vita/scambi-chiavi.jpg');
const ART = {
  chiave: require('../../assets/web/3d/chiave-3d.png'),
  orologio: require('../../assets/vita/orologio.png'),
  campanella: require('../../assets/web/menu/bell-gold.png'),
};
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
 * Tab «Scambi» dell'allievo. REG-789 (anteprime V1a/V1b, Tiziano 25/11/2026):
 * sezione con copertina elastica (chiavi 3D) e UNA card protagonista che
 * cambia con lo stato: la prima guida lasciata dai compagni («Prendila»),
 * altrimenti la propria richiesta in attesa (orologio, «resta tua alle …»,
 * «Ritira»), altrimenti «Non puoi venire a una guida?» che apre il foglio
 * «Lascia una guida» (`swaps/leave-lesson`). Il resto a righe con i 3D.
 * Prendere una guida chiede conferma (alert nativo): è una prenotazione vera;
 * anche ritirare la richiesta chiede conferma.
 */
export function StudentSwapsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const barOverlap = useTabBarOverlap();
  // Per l'allievo la tab bar ha già il suo spazio: l'altezza utile è quella della scena, non della finestra.
  const [viewH, setViewH] = useState(0);
  const stretch = useStretchyCover({ base: Math.round(height * 0.3), viewportHeight: viewH || height, bottomInset: barOverlap });
  const { studentId, offers, myOffers, loading, refetch } = useStudentSwaps({ enabled: true, poll: true });
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  // REG-790: si prende dal foglio di riepilogo (`swap-detail`): l'esito torna
  // al foglio, che si chiude e mostra il quadratino STOP → OK, o dice l'errore.
  const accept = useCallback(
    async (offerId: string): Promise<SwapTakeResult> => {
      if (!studentId) return { status: 'error', message: "Sessione scaduta: riapri l'app e riprova." };
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

  // L'avviso di un foglio (es. «Lascia una guida») compare qui, a foglio chiuso.
  useEffect(
    () =>
      swapNoticeStore.subscribe(() => {
        const n = swapNoticeStore.take();
        if (n) setToast(n);
      }),
    [],
  );

  const confirmRevoke = useCallback(
    (o: AutoscuolaSwapOfferWithDetails) => {
      Alert.alert('Ritirare la richiesta?', 'La guida resta tua e i compagni non la vedono più.', [
        { text: 'Indietro', style: 'cancel' },
        { text: 'Ritira', style: 'destructive', onPress: () => revoke(o.id) },
      ]);
    },
    [revoke],
  );

  const openLeave = useCallback(() => router.push('/(tabs)/swaps/leave-lesson'), [router]);

  const featured = offers[0] ?? null;
  const others = offers.slice(1);
  // Il protagonista cambia con lo stato: una guida da prendere, poi la propria
  // richiesta in attesa, altrimenti l'invito a lasciarne una.
  const pending = featured ? null : (myOffers[0] ?? null);
  const restMine = pending ? myOffers.slice(1) : myOffers;

  return (
    <View style={s.root} onLayout={(e) => setViewH(Math.round(e.nativeEvent.layout.height))}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <StretchyCover style={stretch.coverStyle} testID="swaps-cover">
        <Image source={COVER} style={s.coverImg} resizeMode="cover" accessibilityIgnoresInvertColors />
      </StretchyCover>

      <Animated.ScrollView
        style={StyleSheet.absoluteFill}
        onScroll={stretch.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: barOverlap }}
        testID="swaps-screen"
      >
        <StretchySpacer style={stretch.spacerStyle} />
        <View style={[stretchyPanel, s.panel]} onLayout={stretch.onPanelLayout}>
          <Text style={s.title} accessibilityRole="header">
            Scambi
          </Text>
          <Text style={s.lead}>Guide lasciate dai compagni: chi arriva prima, guida.</Text>

          {loading ? (
            <Animated.View exiting={OUT} style={s.skeleton}>
              <SkeletonBlock width="100%" height={200} radius={28} />
              <SkeletonBlock width="100%" height={56} radius={14} />
            </Animated.View>
          ) : (
            <Animated.View entering={IN}>
              {featured ? (
                <ClaySurface
                  style={s.hero}
                  onPress={() => openOffer(featured)}
                  accessibilityLabel={`Guida lasciata da un compagno, ${longDay(featured.appointment.startsAt)}`}
                >
                  <Text style={s.over}>Lasciata da un compagno · {whenWords(featured.appointment.startsAt)}</Text>
                  <Text style={s.big}>{longDay(featured.appointment.startsAt)}</Text>
                  <Text style={s.line} numberOfLines={1}>
                    {[timeRangeWords(featured.appointment), featured.appointment.locationName].filter(Boolean).join(' · ')}
                  </Text>
                  {featured.appointment.instructorName ? (
                    <View style={s.who}>
                      <Avatar userId={null} name={featured.appointment.instructorName} size={28} />
                      <Text style={s.whoTx} numberOfLines={1}>
                        {[featured.appointment.instructorName, featured.appointment.vehicleName].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  ) : null}
                  <ClayButton
                    title="Prendila"
                    compact
                    onPress={() => openOffer(featured)}
                    style={s.heroCta}
                    testID="swap-take-featured"
                  />
                </ClaySurface>
              ) : pending ? (
                <ClaySurface style={s.hero} testID="swap-pending-hero">
                  <Icon3D source={ART.orologio} size={88} style={s.heroArtClock} />
                  <Text style={s.over}>La tua guida lasciata</Text>
                  <Text style={[s.big, s.bigPending]} numberOfLines={1}>
                    {weekdayWord(pending.appointment.startsAt)} {new Date(pending.appointment.startsAt).getDate()} · {timeRangeWords(pending.appointment).split(' – ')[0]}
                  </Text>
                  <Text style={s.line}>In attesa di un compagno</Text>
                  <View style={s.heroFoot}>
                    <Text style={s.heroFootTx}>
                      Se nessuno la prende, resta tua.{'\n'}Si chiude alle {hmOf(pending.expiresAt)}.
                    </Text>
                    <ClayButton
                      variant="secondary"
                      compact
                      title="Ritira"
                      onPress={() => confirmRevoke(pending)}
                      style={s.ritira}
                      testID="swap-revoke-hero"
                    />
                  </View>
                </ClaySurface>
              ) : (
                <ClaySurface style={[s.hero, s.heroLeave]} testID="swap-leave-hero">
                  <Icon3D source={ART.chiave} size={100} style={s.heroArtKey} />
                  <Text style={s.mid}>Non puoi venire a una guida?</Text>
                  <Text style={[s.line, s.leaveLine]}>Lasciala a un compagno: la prende il primo libero a quell'ora.</Text>
                  <ClayButton title="Lascia una guida" compact onPress={openLeave} style={[s.heroCta, s.leaveCta]} testID="swap-leave-open" />
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

              {restMine.length ? (
                <HomeSection title="Le tue richieste">
                  {restMine.map((o, i) => (
                    <FlatRow
                      key={o.id}
                      first={i === 0}
                      leading={<Icon3D source={ART.orologio} size={36} />}
                      title={`${weekdayWord(o.appointment.startsAt)} ${new Date(o.appointment.startsAt).getDate()} · ${timeRangeWords(o.appointment)}`}
                      subtitle={`In attesa · resta tua alle ${hmOf(o.expiresAt)}`}
                      onPress={() => openMine(o)}
                      trailing={
                        <Pressable onPress={() => confirmRevoke(o)} hitSlop={10} accessibilityRole="button" testID={`swap-revoke-${o.id}`}>
                          <Text style={s.take}>Ritira</Text>
                        </Pressable>
                      }
                      testID={`swap-mine-${o.id}`}
                    />
                  ))}
                </HomeSection>
              ) : null}

              <View style={s.rows}>
                {featured || pending ? (
                  <FlatRow
                    first
                    leading={<Icon3D source={ART.chiave} size={38} />}
                    title={myOffers.length ? "Lascia un'altra guida" : 'Lascia una guida'}
                    subtitle="Scegli fra le tue prossime"
                    onPress={openLeave}
                    testID="swap-leave-row"
                  />
                ) : null}
                {!offers.length ? (
                  <FlatRow
                    first={!(featured || pending)}
                    leading={<Icon3D source={ART.campanella} size={36} />}
                    title="Nessuna guida dei compagni, per ora"
                    subtitle="Se ne lasciano una quando sei libero, ti avvisiamo subito."
                  />
                ) : null}
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Barra trasparente sulla copertina, bianca col titolo quando il foglio ci passa sotto. */}
      <ClayNavBar title="Scambi" scrollY={stretch.scrollY} overlay={stretch.coverHeight - COVER_OVERLAP - (insets.top + NAV_BAR_H) + 30} />
    </View>
  );
}

const hmOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  coverImg: { width: '100%', height: '100%' },
  panel: { paddingTop: 26, paddingHorizontal: 20, paddingBottom: 28 },
  title: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  lead: { fontSize: 15.5, lineHeight: 21, color: CLAY.ink2, marginTop: 4 },
  skeleton: { marginTop: 20, gap: 16 },
  hero: { marginTop: 20 },
  heroLeave: { paddingRight: 112 },
  heroArtKey: { position: 'absolute', right: 8, top: -14, transform: [{ rotate: '-8deg' }] },
  heroArtClock: { position: 'absolute', right: 12, top: -20 },
  over: { fontSize: 14, color: CLAY.ink3 },
  big: { fontSize: 26, lineHeight: 31, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8, marginTop: 2 },
  bigPending: { fontSize: 30, lineHeight: 35, letterSpacing: -1, marginRight: 70 },
  mid: { fontSize: 21, lineHeight: 26, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  line: { fontSize: 15.5, lineHeight: 21, color: CLAY.ink2, marginTop: 4 },
  leaveLine: { marginRight: -8 },
  leaveCta: { marginRight: -92 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  whoTx: { flex: 1, fontSize: 15, color: CLAY.ink2 },
  heroCta: { marginTop: 16, marginRight: 0 },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(17,17,17,0.12)',
  },
  heroFootTx: { flex: 1, fontSize: 14.5, lineHeight: 20, color: CLAY.ink2 },
  ritira: { alignSelf: 'center', paddingHorizontal: 20 },
  rows: { marginTop: 18 },
  take: { fontSize: 15.5, fontWeight: '600', color: CLAY.ink, paddingVertical: 8, paddingLeft: 10, paddingRight: 2 },
  dt: { alignItems: 'center' },
  dtNum: { fontSize: 22, lineHeight: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  dtMonth: { fontSize: 12.5, color: CLAY.ink3 },
});
