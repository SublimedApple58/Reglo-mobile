import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';

import { rescheduleStore } from '../../../src/stores/rescheduleStore';
import { regloApi } from '../../../src/services/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

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
    return <View style={s.root} />;
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

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn} disabled={pending}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title} numberOfLines={1}>Sposta guida di {studentName}</Text>
        <Text style={s.subtitle}>Oggi: {slotLabel(originalStart)}</Text>
      </View>

      {/* Data — Airbnb style: label + valore + Modifica */}
      <View style={s.field}>
        <View style={s.fieldHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Data</Text>
            <Text style={s.fieldValue}>{newDate ? dateOnly(newDate) : '—'}</Text>
          </View>
          <Pressable onPress={() => toggle('date')} disabled={pending} style={({ pressed }) => [s.editBtn, editing === 'date' && s.editBtnActive, pressed && { opacity: 0.7 }]}>
            <Text style={[s.editBtnText, editing === 'date' && s.editBtnTextActive]}>{editing === 'date' ? 'Fatto' : 'Modifica'}</Text>
          </Pressable>
        </View>
        {editing === 'date' ? (
          <DateTimePicker
            mode="date"
            display="spinner"
            value={newDate ?? originalStart}
            onChange={(_e, d) => { if (d) { setNewDate(d); setServerError(null); } }}
            style={s.spinner}
          />
        ) : null}
      </View>

      <View style={s.divider} />

      {/* Orario */}
      <View style={s.field}>
        <View style={s.fieldHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Orario</Text>
            <Text style={s.fieldValue}>{newTime ? timeOnly(newTime) : '—'}</Text>
          </View>
          <Pressable onPress={() => toggle('time')} disabled={pending} style={({ pressed }) => [s.editBtn, editing === 'time' && s.editBtnActive, pressed && { opacity: 0.7 }]}>
            <Text style={[s.editBtnText, editing === 'time' && s.editBtnTextActive]}>{editing === 'time' ? 'Fatto' : 'Modifica'}</Text>
          </Pressable>
        </View>
        {editing === 'time' ? (
          <DateTimePicker
            mode="time"
            display="spinner"
            value={newTime ?? originalStart}
            onChange={(_e, d) => { if (d) { setNewTime(d); setServerError(null); } }}
            style={s.spinner}
          />
        ) : null}
      </View>

      {newStart && !isSame ? (
        <View style={s.preview}>
          <View style={s.previewBadge}><Text style={s.previewBadgeText}>NUOVA</Text></View>
          <Text style={s.previewSlot} numberOfLines={1}>{slotLabel(newStart)}</Text>
          {diff ? <View style={s.diffPill}><Text style={s.diffPillText}>{diff}</Text></View> : null}
        </View>
      ) : null}

      {isPast ? (
        <View style={s.warnBanner}>
          <Ionicons name="alert-circle" size={16} color="#B45309" />
          <Text style={s.warnText}>Non puoi spostare la guida a un orario passato.</Text>
        </View>
      ) : null}

      {serverError ? (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.destructive} />
          <Text style={s.errorText}>{serverError}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [s.confirmBtn, pressed && { opacity: 0.9 }, !canSubmit && { opacity: 0.4 }]}
      >
        <Text style={s.confirmText}>{pending ? 'Spostando…' : 'Conferma spostamento'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 14 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  field: { gap: 6 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.1 },
  fieldValue: { fontSize: 17, fontWeight: '500', color: '#1A1A2E', letterSpacing: -0.3, marginTop: 1 },
  editBtn: { backgroundColor: '#F0F0F1', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  editBtnActive: { backgroundColor: '#1A1A2E' },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  editBtnTextActive: { color: '#FFFFFF' },
  spinner: { alignSelf: 'stretch', ...(Platform.OS === 'ios' ? { height: 180 } : {}) },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEBEB' },

  preview: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: '#F1F0ED', padding: 14 },
  previewBadge: { backgroundColor: '#1A1A2E', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 },
  previewBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  previewSlot: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  diffPill: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  diffPillText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },

  warnBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  warnText: { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '500' },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  errorText: { flex: 1, fontSize: 13, color: '#991B1B', fontWeight: '500' },

  confirmBtn: { backgroundColor: '#1A1A2E', minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 6 },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
