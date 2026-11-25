import React, { memo, useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { FormSheet } from '../components/SheetScaffold';
import { Avatar, ClayButton, ClayPressable, Icon3D } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { useAppointments } from '../hooks/queries/useAppointments';
import { useStudentSwaps } from '../hooks/useStudentSwaps';
import { regloApi } from '../services/regloApi';
import { notificationEvents } from '../services/notificationEvents';
import { car34Art } from '../road/markerArt';
import { swapNoticeStore } from '../stores/swapNoticeStore';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { firstName } from '../components/studentLesson/LessonSheetParts';
import { isUpcomingLesson, monthShort, swapBlockReason, timeRangeWords, weekdayWord } from '../utils/studentLessons';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

const KEY_ART = require('../../assets/web/3d/chiave-3d.png');
const TICK_IN = FadeIn.duration(180).reduceMotion(ReduceMotion.Never);
const TICK_OUT = FadeOut.duration(120).reduceMotion(ReduceMotion.Never);

type Item =
  | { kind: 'week'; key: string; title: string }
  | { kind: 'lesson'; key: string; lesson: AutoscuolaAppointmentWithRelations; blocked: string | null };

const mondayOf = (d: Date) => {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};

/** «Questa settimana», «Prossima settimana», «Settimana del 15 dicembre». */
const weekTitle = (monday: Date) => {
  const weeks = Math.round((monday.getTime() - mondayOf(new Date()).getTime()) / (7 * 86400000));
  if (weeks <= 0) return 'Questa settimana';
  if (weeks === 1) return 'Prossima settimana';
  return `Settimana del ${monday.getDate()} ${monday.toLocaleDateString('it-IT', { month: 'long' })}`;
};

const hm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * REG-789 — «Lascia una guida» dalla tab Scambi (anteprima V1c, Tiziano
 * 25/11/2026, con il raggruppamento per settimana di V2c): le guide in
 * programma dell'allievo, una riga ricca per guida (data in tessera clay,
 * istruttore, auto 3D nel colore del veicolo). Si sceglie toccando: la riga
 * scelta sale in clay col bordo nero e la spunta; la CTA conferma. Le guide
 * che non si possono lasciare restano al loro posto, spente, col motivo
 * (`swapBlockReason`, le regole del server). La richiesta è la stessa del
 * «Cerca sostituto» del foglio guida (`createSwapOffer`), nessun aggiornamento
 * ottimistico: si aspetta il server, poi si ricaricano i dati.
 */
export function LeaveLessonSheet() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const studentId = user?.id ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const params = useMemo(() => {
    if (!studentId) return null;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 120);
    to.setHours(23, 59, 59, 999);
    return { studentId, from: from.toISOString(), to: to.toISOString(), limit: 200 };
  }, [studentId]);
  const query = useAppointments(params);
  const { myOffers } = useStudentSwaps({ enabled: true });

  const items = useMemo<Item[]>(() => {
    const open = new Set(myOffers.map((o) => o.appointmentId));
    const upcoming = (query.data ?? [])
      .filter((l) => isUpcomingLesson(l))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const out: Item[] = [];
    let week = '';
    for (const l of upcoming) {
      const monday = mondayOf(new Date(l.startsAt));
      const wk = monday.toISOString();
      if (wk !== week) {
        week = wk;
        out.push({ kind: 'week', key: `w-${wk}`, title: weekTitle(monday) });
      }
      out.push({ kind: 'lesson', key: l.id, lesson: l, blocked: swapBlockReason(l, open.has(l.id)) });
    }
    return out;
  }, [query.data, myOffers]);

  const chosen = useMemo(() => {
    const it = items.find((i) => i.kind === 'lesson' && i.key === selected);
    return it && it.kind === 'lesson' && !it.blocked ? it.lesson : null;
  }, [items, selected]);

  const send = useCallback(async () => {
    if (!chosen) return;
    setSending(true);
    try {
      await regloApi.createSwapOffer(chosen.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swap-my-offers'] }),
        queryClient.invalidateQueries({ queryKey: ['swap-offers'] }),
      ]);
      notificationEvents.emitDataChanged();
      swapNoticeStore.set({ text: 'Guida lasciata: ora la vedono i compagni', tone: 'success' });
      setSending(false);
      router.back();
    } catch (err) {
      setSending(false);
      Alert.alert('Non è stato possibile lasciarla', err instanceof Error ? err.message : 'Riprova tra poco.');
    }
  }, [chosen, queryClient, router]);

  const renderItem = useCallback(
    ({ item }: { item: Item }) =>
      item.kind === 'week' ? (
        <Text style={s.week}>{item.title}</Text>
      ) : (
        <LeaveOption lesson={item.lesson} blocked={item.blocked} selected={selected === item.key} onSelect={setSelected} />
      ),
    [selected],
  );

  const loading = !query.data && !query.isError;
  const empty = !loading && !items.length;

  return (
    <FormSheet
      testID="leave-lesson-sheet"
      leading={<Icon3D source={KEY_ART} size={46} style={s.key} />}
      title="Lascia una guida"
      subtitle="Quale non riesci a fare?"
      busy={sending}
      list={{ data: items, renderItem, keyExtractor: (i: Item) => i.key, extraData: selected }}
      cta={
        empty ? undefined : (
          <View>
            <Text style={s.foot}>Se nessuno la prende entro un'ora dall'inizio, resta tua.</Text>
            <ClayButton
              title={chosen ? `Lascia ${weekdayWord(chosen.startsAt).toLowerCase()} ${new Date(chosen.startsAt).getDate()} alle ${hm(chosen.startsAt)}` : 'Scegli una guida'}
              disabled={!chosen}
              loading={sending}
              onPress={send}
              testID="leave-lesson-confirm"
            />
          </View>
        )
      }
    >
      {loading ? (
        <View style={s.skeleton}>
          <SkeletonBlock height={72} radius={22} />
          <SkeletonBlock height={72} radius={22} />
          <SkeletonBlock height={72} radius={22} />
        </View>
      ) : empty ? (
        <Text style={s.empty}>Non hai guide in programma da lasciare.</Text>
      ) : null}
    </FormSheet>
  );
}

const LeaveOption = memo(function LeaveOption({
  lesson,
  blocked,
  selected,
  onSelect,
}: {
  lesson: AutoscuolaAppointmentWithRelations;
  blocked: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const who = [firstName(lesson.instructor?.name), lesson.vehicle?.name].filter(Boolean).join(' · ');
  return (
    <ClayPressable
      kind="card"
      onPress={() => onSelect(lesson.id)}
      disabled={!!blocked}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!blocked }}
      style={[s.opt, selected && s.optSel, blocked && s.optOff]}
      testID={`leave-option-${lesson.id}`}
    >
      <View style={s.tile}>
        <Text style={s.tileDay}>{new Date(lesson.startsAt).getDate()}</Text>
        <Text style={s.tileMonth}>{monthShort(lesson.startsAt)}</Text>
      </View>
      <View style={s.optText}>
        <Text style={s.optTitle} numberOfLines={1}>
          {weekdayWord(lesson.startsAt)} · {timeRangeWords(lesson)}
        </Text>
        <View style={s.optWho}>
          {blocked ? null : <Avatar userId={lesson.instructor?.userId ?? lesson.instructor?.id} name={lesson.instructor?.name ?? '?'} size={20} />}
          <Text style={s.optSub} numberOfLines={1}>
            {blocked ?? (who || 'Guida')}
          </Text>
        </View>
      </View>
      {!blocked && lesson.vehicle ? <Icon3D source={car34Art(lesson.vehicle.color)} size={32} width={40} /> : null}
      {blocked ? null : selected ? (
        <Animated.View key="on" entering={TICK_IN} exiting={TICK_OUT} style={s.tick}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </Animated.View>
      ) : (
        <Animated.View key="off" entering={TICK_IN} exiting={TICK_OUT} style={s.ring} />
      )}
    </ClayPressable>
  );
});

const s = StyleSheet.create({
  key: { transform: [{ rotate: '-8deg' }] },
  week: { fontSize: 15, fontWeight: '600', color: CLAY.ink3, marginTop: 16, marginBottom: 4, marginHorizontal: 6 },
  skeleton: { gap: 10, marginTop: 10 },
  empty: { fontSize: 16, lineHeight: 22, color: CLAY.ink3, marginTop: 12 },
  foot: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, textAlign: 'center', marginBottom: 12 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 22,
    marginHorizontal: -6,
    marginVertical: 2,
    backgroundColor: CLAY.surface,
  },
  optSel: {
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: CLAY.ink },
      { offsetX: 0, offsetY: 12, blurRadius: 24, spreadDistance: -12, color: 'rgba(0,0,0,0.28)' },
    ],
  },
  optOff: { opacity: 0.42 },
  tile: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...CLAY_SHADOW.raiseSm,
  },
  tileDay: { fontSize: 20, lineHeight: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  tileMonth: { fontSize: 11.5, color: CLAY.ink3 },
  optText: { flex: 1, minWidth: 0 },
  optTitle: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  optWho: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  optSub: { flexShrink: 1, fontSize: 14, color: CLAY.ink3 },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: CLAY.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...CLAY_SHADOW.ink,
  },
  ring: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: CLAY.surface,
    ...CLAY_SHADOW.sink,
  },
});
