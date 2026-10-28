import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow } from '../../../src/components/clay';
import { rescheduleStore } from '../../../src/stores/rescheduleStore';
import { regloApi } from '../../../src/services/regloApi';
import { CLAY } from '../../../src/theme/clay';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../../src/utils/motion';

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const pad = (n: number) => String(n).padStart(2, '0');
const dateOnly = (d: Date) => `${WD[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
const timeOnly = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const slotLabel = (d: Date) => `${dateOnly(d)} · ${timeOnly(d)}`;

const buildDiff = (oldD: Date, newD: Date): string | null => {
  const ms = newD.getTime() - oldD.getTime();
  if (ms === 0) return null;
  const sign = ms > 0 ? '+' : '−';
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs - days * 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs - days * 86_400_000 - hours * 3_600_000) / 60_000);
  const parts: string[] = [];
  if (days) parts.push(`${sign}${days}g`);
  if (hours) parts.push(`${sign}${hours}h`);
  if (minutes) parts.push(`${sign}${minutes}m`);
  return parts.length ? parts.join(' · ') : null;
};

export default function RescheduleLessonScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(rescheduleStore.subscribe, rescheduleStore.get);
  const lesson = data?.lesson ?? null;

  const originalStart = useMemo(() => (lesson ? new Date(lesson.startsAt) : null), [lesson]);
  const durationMs = useMemo(() => {
    if (!lesson || !originalStart) return 60 * 60 * 1000;
    return lesson.endsAt ? new Date(lesson.endsAt).getTime() - originalStart.getTime() : 60 * 60 * 1000;
  }, [lesson, originalStart]);

  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newTime, setNewTime] = useState<Date | null>(null);
  const [editing, setEditing] = useState<'date' | 'time' | null>(null);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!originalStart) return;
    setNewDate(new Date(originalStart));
    setNewTime(new Date(originalStart));
    setEditing(null);
    setServerError(null);
    setPending(false);
  }, [originalStart]);

  if (!data || !lesson || !originalStart) {
    return <View style={s.empty} />;
  }

  const newStart = (() => {
    if (!newDate || !newTime) return null;
    const out = new Date(newDate);
    out.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
    return out;
  })();
  const isSame = newStart !== null && newStart.getTime() === originalStart.getTime();
  const isPast = newStart ? newStart.getTime() < Date.now() : false;
  const newEnd = newStart ? new Date(newStart.getTime() + durationMs) : null;
  const diff = newStart ? buildDiff(originalStart, newStart) : null;
  const canSubmit = newStart !== null && !isSame && !isPast && !pending;
  const studentName = `${lesson.student?.firstName ?? ''} ${lesson.student?.lastName ?? ''}`.trim() || 'allievo';

  const toggle = (which: 'date' | 'time') => {
    if (pending) return;
    setEditing((cur) => (cur === which ? null : which));
  };

  const handleSubmit = async () => {
    if (!newStart || !newEnd || !canSubmit) return;
    setPending(true);
    setServerError(null);
    try {
      const res = await regloApi.rescheduleAppointment(lesson.id, {
        startsAt: newStart.toISOString(),
        endsAt: newEnd.toISOString(),
      });
      const successStart = (res as { startsAt?: string } | undefined)?.startsAt ?? newStart.toISOString();
      data.onSuccess(successStart);
      router.back();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Impossibile spostare la guida.';
      setServerError(message);
      data.onError(message);
    } finally {
      setPending(false);
    }
  };

  const editAction = (which: 'date' | 'time') => (
    <Pressable
      onPress={() => toggle(which)}
      disabled={pending}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={editing === which ? 'Fatto' : which === 'date' ? 'Modifica data' : 'Modifica orario'}
      style={({ pressed }) => pressed && { opacity: 0.55 }}
    >
      <Text style={s.edit}>{editing === which ? 'Fatto' : 'Modifica'}</Text>
    </Pressable>
  );

  // REG-639 clay: il form sheet unico. Data e orario sono righe clay con
  // «Modifica» testuale; la rotella si apre sotto la riga con una dissolvenza.
  // Nuovo orario e differenza in testo semplice (niente pillole), errori in
  // rosso senza riquadri colorati.
  return (
    <FormSheet
      title={`Sposta guida di ${studentName}`}
      subtitle={`Oggi: ${slotLabel(originalStart)}`}
      onClose={() => { if (!pending) router.back(); }}
      testID="reschedule-lesson-sheet"
      cta={
        <ClayButton
          title="Conferma spostamento"
          onPress={handleSubmit}
          loading={pending}
          disabled={!canSubmit}
          testID="reschedule-lesson-confirm"
        />
      }
    >
      <ClayList>
        <ClayListRow
          title="Data"
          subtitle={newDate ? dateOnly(newDate) : '—'}
          trailing={editAction('date')}
        />
      </ClayList>
      {editing === 'date' ? (
        <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
          <DateTimePicker
            mode="date"
            display="spinner"
            value={newDate ?? originalStart}
            onChange={(_e, d) => { if (d) { setNewDate(d); setServerError(null); } }}
            style={s.spinner}
          />
        </Animated.View>
      ) : null}

      <ClayList style={s.gap}>
        <ClayListRow
          title="Orario"
          subtitle={newTime ? timeOnly(newTime) : '—'}
          trailing={editAction('time')}
        />
      </ClayList>
      {editing === 'time' ? (
        <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
          <DateTimePicker
            mode="time"
            display="spinner"
            value={newTime ?? originalStart}
            onChange={(_e, d) => { if (d) { setNewTime(d); setServerError(null); } }}
            style={s.spinner}
          />
        </Animated.View>
      ) : null}

      {newStart && !isSame ? (
        <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={s.preview}>
          <Text style={s.previewSlot} numberOfLines={1}>Nuovo orario: {slotLabel(newStart)}</Text>
          {diff ? <Text style={s.diff}>{diff}</Text> : null}
        </Animated.View>
      ) : null}

      {isPast ? <Text style={s.error}>Non puoi spostare la guida a un orario passato.</Text> : null}
      {serverError ? <Text style={s.error}>{serverError}</Text> : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  gap: { marginTop: 14 },
  edit: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  spinner: { alignSelf: 'stretch', ...(Platform.OS === 'ios' ? { height: 180 } : {}) },
  preview: { marginTop: 22, paddingHorizontal: 2 },
  previewSlot: { fontSize: 16, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  diff: { fontSize: 14, color: CLAY.ink3, marginTop: 3 },
  error: { fontSize: 14, lineHeight: 20, color: '#C13515', marginTop: 14, paddingHorizontal: 2 },
});
