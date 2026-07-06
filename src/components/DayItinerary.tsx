import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookableBand } from './BookableBand';
import { fmtClockFull, fmtDuration, type DayExamGroup, type DayGroupLessonGroup, type DayPlan } from '../utils/weeklyAgenda';
import { colors } from '../theme';
import type { AutoscuolaAppointmentWithRelations, InstructorBlock } from '../types/regloApi';

const FLUENT_GRADUATE = require('../../assets/icons/fluent-graduate.png');
const FLUENT_PEOPLE = require('../../assets/icons/fluent-people.png');

type Seq =
  | { kind: 'marker'; min: number; order: number; text: string }
  | { kind: 'lesson'; min: number; order: number; row: DayPlan['lessons'][number] }
  | { kind: 'examGroup'; min: number; order: number; group: DayExamGroup }
  | { kind: 'groupLesson'; min: number; order: number; group: DayGroupLessonGroup }
  | { kind: 'block'; min: number; order: number; row: DayPlan['blocks'][number] }
  | { kind: 'free'; min: number; order: number; s: number; e: number };

type Props = {
  plan: DayPlan;
  onQuickBook: (min: number, ws: number, we: number) => void;
  onOpenLesson: (appt: AutoscuolaAppointmentWithRelations) => void;
  onOpenExam: (appts: AutoscuolaAppointmentWithRelations[]) => void;
  onOpenGroupLesson: (group: DayGroupLessonGroup) => void;
  onOpenBlock: (block: InstructorBlock) => void;
};

/**
 * Vertical itinerary for a single day — rendered IDENTICAL to the daily
 * timeline in IstruttoreHomeScreen (same `itin*` card language): availability
 * markers, elevated lesson cards, the rich student-app exam card (exams sharing
 * a slot collapse into ONE block), blocks, and dashed "Libero" bands with the
 * hold-to-scrub quick-book gesture. Pure presentational — actions delegated to
 * the caller. Used inside the day-detail page sheet.
 */
export const DayItinerary = ({ plan, onQuickBook, onOpenLesson, onOpenExam, onOpenGroupLesson, onOpenBlock }: Props) => {
  const seq: Seq[] = [];
  // One start/end marker per availability window (mirrors the daily timeline).
  plan.availWindows.forEach(([ws, we], wi) => {
    seq.push({ kind: 'marker', min: ws, order: 0, text: wi === 0 ? 'Inizio disponibilità' : 'Ripresa disponibilità' });
    seq.push({ kind: 'marker', min: we, order: 2, text: wi === plan.availWindows.length - 1 ? 'Fine disponibilità' : 'Pausa' });
  });
  plan.lessons.forEach((row) => seq.push({ kind: 'lesson', min: row.startMin, order: 1, row }));
  plan.examGroups.forEach((group) => seq.push({ kind: 'examGroup', min: group.startMin, order: 1, group }));
  plan.groupLessonGroups.forEach((group) => seq.push({ kind: 'groupLesson', min: group.startMin, order: 1, group }));
  plan.blocks.forEach((row) => seq.push({ kind: 'block', min: row.startMin, order: 1, row }));
  plan.freeWindows.forEach(([s, e]) => seq.push({ kind: 'free', min: s, order: 1, s, e }));
  seq.sort((a, b) => a.min - b.min || a.order - b.order);

  if (!seq.length) {
    return <Text style={styles.empty}>Nessuna disponibilità configurata per questo giorno.</Text>;
  }

  // Drop a row's time pill when it starts exactly at a window boundary — the
  // adjacent marker already shows that time (continuous rail line instead).
  const windowStartSet = new Set<number>(plan.availWindows.map(([ws]) => ws));
  const last = seq.length - 1;
  let hintShown = false;

  return (
    <View>
      {seq.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === last;
        const hidePill = item.kind !== 'marker' && windowStartSet.has(item.min);

        if (item.kind === 'marker') {
          return (
            <View key={`mk-${idx}`} style={styles.row}>
              <View style={styles.rail}>
                {!isFirst ? <View style={styles.railLineTop} /> : null}
                {!isLast ? <View style={styles.railLineBottom} /> : null}
                <View style={[styles.railPill, styles.railPillMuted]}>
                  <Text style={[styles.railPillText, styles.railPillTextMuted]}>{fmtClockFull(item.min)}</Text>
                </View>
              </View>
              <View style={styles.markerBody}><Text style={styles.markerText}>{item.text}</Text></View>
            </View>
          );
        }

        if (item.kind === 'free') {
          const showHint = !hintShown; hintShown = true;
          return (
            <View key={`free-${idx}`} style={styles.row}>
              <Rail time={fmtClockFull(item.s)} isFirst={isFirst} isLast={isLast} muted hidePill={hidePill} />
              <View style={styles.freeBody}>
                <BookableBand windowStart={item.s} windowEnd={item.e} bookableStarts={plan.bookableStarts} showHint={showHint} onPick={(min) => {
                  const win = plan.freeWindows.find(([ws, we]) => min >= ws && min < we) ?? [min, min + 15];
                  onQuickBook(min, win[0], win[1]);
                }} />
              </View>
            </View>
          );
        }

        if (item.kind === 'examGroup') {
          const g = item.group;
          const sub = `${g.count} ${g.count === 1 ? 'allievo' : 'allievi'} · ${fmtDuration(g.durationMin)}`;
          return (
            <View key={`ex-${g.id}`} style={styles.row}>
              <Rail time={fmtClockFull(item.min)} isFirst={isFirst} isLast={isLast} hidePill={hidePill} />
              <Pressable onPress={() => onOpenExam(g.appts)} style={({ pressed }) => [styles.examCard, pressed && styles.cardPressed]}>
                <Image source={FLUENT_GRADUATE} style={styles.examIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.examLabel}>Esame di guida</Text>
                  <Text style={styles.examTitle} numberOfLines={1}>{sub}</Text>
                </View>
              </Pressable>
            </View>
          );
        }

        if (item.kind === 'groupLesson') {
          const g = item.group;
          const isMotoGroup = g.kind === 'moto';
          const sub = `${g.count}/${g.capacity} allievi · ${fmtDuration(g.durationMin)}`;
          return (
            <View key={`gl-${g.id}`} style={styles.row}>
              <Rail time={fmtClockFull(item.min)} isFirst={isFirst} isLast={isLast} hidePill={hidePill} />
              <Pressable onPress={() => onOpenGroupLesson(g)} style={({ pressed }) => [styles.groupCard, isMotoGroup && styles.groupCardMoto, pressed && styles.cardPressed]}>
                <Image source={FLUENT_PEOPLE} style={styles.groupIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupLabel, isMotoGroup && styles.groupLabelMoto]}>{isMotoGroup ? 'Guida di gruppo moto' : 'Guida di gruppo'}</Text>
                  <Text style={styles.groupTitle} numberOfLines={1}>{sub}</Text>
                </View>
                <View style={styles.seats}>
                  {Array.from({ length: g.capacity }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.seat,
                        isMotoGroup && styles.seatMoto,
                        i >= g.count && (isMotoGroup ? styles.seatEmptyMoto : styles.seatEmpty),
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
            </View>
          );
        }

        if (item.kind === 'block') {
          const { block, isSick } = item.row;
          return (
            <View key={`bl-${idx}`} style={styles.row}>
              <Rail time={fmtClockFull(item.min)} isFirst={isFirst} isLast={isLast} muted hidePill={hidePill} />
              <Pressable onPress={() => onOpenBlock(block)} style={({ pressed }) => [styles.card, styles.cardMuted, pressed && styles.cardPressed]}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name={isSick ? 'medkit' : 'lock-closed'} size={17} color={isSick ? '#EA580C' : '#94A3B8'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: '#64748B' }]} numberOfLines={1}>{isSick ? 'In malattia' : (block.reason || 'Slot bloccato')}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{isSick ? 'Guide cancellate e allievi avvisati' : 'Non prenotabile'}</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          );
        }

        // lesson
        const row = item.row;
        const a = row.appt;
        const initials = `${a.student?.firstName?.[0] ?? ''}${a.student?.lastName?.[0] ?? ''}`.toUpperCase() || '·';
        const name = `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim() || 'Allievo';
        return (
          <View key={`ap-${idx}`} style={styles.row}>
            <Rail time={fmtClockFull(item.min)} isFirst={isFirst} isLast={isLast} hidePill={hidePill} />
            <Pressable onPress={() => onOpenLesson(a)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{fmtDuration(row.durationMin)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: row.badge.bg }]}>
                  <Text style={[styles.badgeText, { color: row.badge.text }]} numberOfLines={1}>{row.badge.label}</Text>
                </View>
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};

const Rail = ({ time, isFirst, isLast, muted, hidePill }: { time: string; isFirst: boolean; isLast: boolean; muted?: boolean; hidePill?: boolean }) => (
  <View style={styles.rail}>
    {hidePill ? (
      <View style={styles.railLineFull} />
    ) : (
      <>
        {!isFirst ? <View style={styles.railLineTop} /> : null}
        {!isLast ? <View style={styles.railLineBottom} /> : null}
        <View style={[styles.railPill, muted && styles.railPillMuted]}>
          <Text style={[styles.railPillText, muted && styles.railPillTextMuted]}>{time}</Text>
        </View>
      </>
    )}
  </View>
);

// Mirrors the daily timeline (itin*) styles in IstruttoreHomeScreen.
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 84, paddingTop: 16, alignItems: 'center', position: 'relative' },
  railLineTop: { position: 'absolute', left: 41, top: 0, height: 12, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railLineBottom: { position: 'absolute', left: 41, top: 46, bottom: -14, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railLineFull: { position: 'absolute', left: 41, top: 0, bottom: -14, width: 2, backgroundColor: '#E6E8EC', borderRadius: 1 },
  railPill: { minHeight: 26, minWidth: 52, paddingHorizontal: 9, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: '#EEF0F4' },
  railPillMuted: { backgroundColor: '#F1F3F7' },
  railPillText: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  railPillTextMuted: { color: '#94A3B8' },

  markerBody: { flex: 1, paddingTop: 22, marginBottom: 14 },
  markerText: { fontSize: 13, fontWeight: '700', color: '#475569', letterSpacing: 0.1 },

  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, marginBottom: 14, shadowColor: '#1A1A2E', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  cardMuted: { backgroundColor: '#F7F8FA', shadowOpacity: 0, elevation: 0 },
  cardPressed: { opacity: 0.95, transform: [{ scale: 0.992 }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  name: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2 },
  meta: { fontSize: 13, fontWeight: '500', color: '#94A3B8', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginLeft: 8, flexShrink: 0 },
  badgeText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.1 },

  // Exam — student-app card language (lavender surface, Fluent 3D icon), no right tag.
  examCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F5F0FF', borderRadius: 22, padding: 14, marginBottom: 14, shadowColor: '#8B5CF6', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  examIcon: { width: 42, height: 42 },
  examLabel: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  examTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2, marginTop: 2 },

  // Group lesson — teal sibling of the exam card (Fluent 3D people icon).
  // Moto groups: identical style, ORANGE tint (bg/shadow/label/seats).
  groupCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ECFDF5', borderRadius: 22, padding: 14, marginBottom: 14, shadowColor: '#10B981', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  groupCardMoto: { backgroundColor: '#FFF4EA', shadowColor: '#F97316' },
  groupIcon: { width: 42, height: 42 },
  groupLabel: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  groupLabelMoto: { color: '#C2410C' },
  groupTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.2, marginTop: 2 },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8 },
  seat: { width: 9, height: 9, borderRadius: 3, backgroundColor: '#10B981' },
  seatEmpty: { backgroundColor: '#BDEAD6' },
  seatMoto: { backgroundColor: '#F97316' },
  seatEmptyMoto: { backgroundColor: '#FCD9B8' },

  freeBody: { flex: 1 },

  empty: { fontSize: 13, color: colors.textMuted, paddingVertical: 14 },
});
