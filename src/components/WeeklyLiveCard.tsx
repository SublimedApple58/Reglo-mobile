import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

const FLUENT_GRADUATE = require('../../assets/icons/fluent-graduate.png');

type Props = {
  lesson: AutoscuolaAppointmentWithRelations;
  isExam: boolean;
  examCount: number;
  isGroup?: boolean;
  groupCount?: number;
  inProgress: boolean;
  isCheckedIn: boolean;
  showActions: boolean;
  isPending: boolean;
  pendingAction: 'checked_in' | 'no_show' | null;
  topLabel: string;       // "Tra 20 min" | "Alle 16:00" (used when NOT in progress)
  timeText: string;       // "14:30 – 15:30"
  vehicleText: string | null;
  onPresent: () => void;
  onAbsent: () => void;
  onOpen: () => void;
};

/**
 * "Live" card pinned above the weekly overview — surfaces the current/next
 * lesson (or exam) of TODAY so the instructor gets immediate live feedback and
 * can mark Presente/Assente inline without drilling into the day. Driven by the
 * existing featured-lesson + check-in logic in IstruttoreHomeScreen.
 */
export const WeeklyLiveCard = ({
  lesson, isExam, examCount, isGroup = false, groupCount = 0,
  inProgress, isCheckedIn, showActions, isPending, pendingAction,
  topLabel, timeText, vehicleText, onPresent, onAbsent, onOpen,
}: Props) => {
  const name = `${lesson.student?.firstName ?? ''} ${lesson.student?.lastName ?? ''}`.trim() || 'Allievo';
  const initials = `${lesson.student?.firstName?.[0] ?? ''}${lesson.student?.lastName?.[0] ?? ''}`.toUpperCase() || '·';
  const groupLabel = `${groupCount} alliev${groupCount === 1 ? 'o' : 'i'}`;
  const metaLine = isGroup
    ? [groupLabel, timeText, vehicleText].filter(Boolean).join(' · ')
    : inProgress
      ? (isExam ? timeText : (vehicleText ?? ''))
      : [timeText, isExam ? null : vehicleText].filter(Boolean).join(' · ');

  const Kicker = (
    <View style={styles.head}>
      <View style={[styles.dot, inProgress ? styles.dotLive : styles.dotSoon]} />
      <Text style={[styles.kick, inProgress ? styles.kickLive : styles.kickSoon]}>
        {inProgress ? 'IN CORSO' : topLabel}
        {inProgress ? <Text style={styles.kickSep}>  ·  {timeText}</Text> : null}
      </Text>
    </View>
  );

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {Kicker}

      <View style={styles.top}>
        {isExam ? (
          <Image source={FLUENT_GRADUATE} style={styles.examIcon} />
        ) : isGroup ? (
          <View style={styles.avatar}><Ionicons name="people" size={22} color="#1A1A2E" /></View>
        ) : (
          <View style={styles.avatar}><Text style={styles.avatarTx}>{initials}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          {isExam ? <Text style={styles.examKicker}>Esame di guida</Text> : null}
          <Text style={styles.name} numberOfLines={1}>
            {isGroup ? 'Guida di gruppo' : isExam ? (examCount === 0 ? 'Nessun allievo' : `${examCount} ${examCount === 1 ? 'allievo' : 'allievi'}`) : name}
          </Text>
          {!isExam && !isGroup && inProgress && isCheckedIn ? (
            <View style={styles.donePill}>
              <Ionicons name="checkmark" size={13} color="#16A34A" />
              <Text style={styles.donePillTx}>Presente</Text>
            </View>
          ) : metaLine ? (
            <Text style={styles.meta} numberOfLines={1}>{metaLine}</Text>
          ) : null}
        </View>
        {!showActions || (inProgress && isCheckedIn) ? (
          <Ionicons name="chevron-forward" size={20} color="#AEB4CC" />
        ) : null}
      </View>

      {/* Actions: two pills when to-mark; a discreet "Segna assente" once present */}
      {showActions && !isCheckedIn ? (
        <View style={styles.acts}>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); if (!isPending) onPresent(); }}
            disabled={isPending}
            style={({ pressed }) => [styles.btn, styles.present, pressed && { opacity: 0.85 }, isPending && { opacity: 0.5 }]}
          >
            {pendingAction === 'checked_in' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <><Ionicons name="checkmark" size={17} color="#FFFFFF" /><Text style={styles.presentTx}>Presente</Text></>
            )}
          </Pressable>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); if (!isPending) onAbsent(); }}
            disabled={isPending}
            style={({ pressed }) => [styles.btn, styles.absent, pressed && { opacity: 0.85 }, isPending && { opacity: 0.5 }]}
          >
            {pendingAction === 'no_show' ? (
              <ActivityIndicator size="small" color="#6A6A6A" />
            ) : (
              <><Ionicons name="close" size={16} color="#6A6A6A" /><Text style={styles.absentTx}>Assente</Text></>
            )}
          </Pressable>
        </View>
      ) : null}

      {showActions && isCheckedIn ? (
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); if (!isPending) onAbsent(); }}
          disabled={isPending}
          style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }, isPending && { opacity: 0.5 }]}
        >
          <Ionicons name="close" size={14} color="#AEB4CC" />
          <Text style={styles.ghostTx}>{pendingAction === 'no_show' ? 'Attendi…' : 'Segna assente'}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 22, marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, shadowColor: '#1A1A2E', shadowOpacity: 0.08, shadowRadius: 26, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  pressed: { opacity: 0.97, transform: [{ scale: 0.995 }] },

  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotLive: { backgroundColor: '#16A34A', shadowColor: '#16A34A', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  dotSoon: { backgroundColor: '#AEB4CC' },
  kick: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  kickLive: { color: '#1A1A2E' },
  kickSoon: { color: '#6E7596' },
  kickSep: { color: '#AEB4CC', fontWeight: '600' },

  top: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEF0F4', alignItems: 'center', justifyContent: 'center' },
  avatarTx: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  examIcon: { width: 48, height: 48 },
  examKicker: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  name: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  meta: { fontSize: 13, fontWeight: '400', color: '#929292', marginTop: 3 },
  donePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDF4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  donePillTx: { fontSize: 12, fontWeight: '600', color: '#16A34A' },

  acts: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, height: 48, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  present: { backgroundColor: '#1A1A2E' },
  presentTx: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  absent: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#E9EBF2' },
  absentTx: { fontSize: 14, fontWeight: '600', color: '#6A6A6A' },

  ghost: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginTop: 8 },
  ghostTx: { fontSize: 13, fontWeight: '500', color: '#6E7596' },
});
