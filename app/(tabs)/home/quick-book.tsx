import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { quickBookStore } from '../../../src/stores/quickBookStore';
import { SearchableSelect } from '../../../src/components/SearchableSelect';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

type Mode = 'lesson' | 'block' | 'sick';
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default function QuickBookScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(quickBookStore.subscribe, quickBookStore.get);

  const [mode, setMode] = useState<Mode>('lesson');
  const [start, setStart] = useState(540);
  const [duration, setDuration] = useState(60);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!data) return;
    setMode('lesson');
    setStart(data.startMinutes);
    setDuration(data.defaultDuration);
    setStudentId(null);
    setReason('');
    setPending(false);
  }, [data]);

  const windowEnd = data?.windowEndMinutes ?? 0;
  const windowStart = data?.windowStartMinutes ?? 0;

  const fittingDurations = useMemo(() => {
    const list = (data?.durations ?? [60]).filter((d) => start + d <= windowEnd);
    return list.length ? list : [(data?.durations ?? [60])[0]];
  }, [data?.durations, start, windowEnd]);

  useEffect(() => {
    if (!fittingDurations.includes(duration)) setDuration(fittingDurations[0]);
  }, [fittingDurations, duration]);

  if (!data) return <View style={s.root} />;

  // Sick can start anywhere up to end of day; lesson/block must leave room for 15'.
  const maxStart = mode === 'sick' ? windowEnd - 15 : windowEnd - 15;
  const pickerValue = (() => {
    const d = new Date(data.date);
    d.setHours(Math.floor(start / 60), start % 60, 0, 0);
    return d;
  })();
  const onPickTime = (_e: unknown, d?: Date) => {
    if (!d) return;
    const m = d.getHours() * 60 + d.getMinutes();
    setStart(Math.max(windowStart, Math.min(maxStart, m)));
  };

  const endMinutes = start + duration;
  const canConfirm = mode === 'lesson' ? !!studentId && !pending : !pending;

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    let ok = false;
    if (mode === 'lesson') ok = await data.onCreateLesson({ studentId: studentId as string, startMinutes: start, duration });
    else if (mode === 'block') ok = await data.onCreateBlock({ reason: reason.trim(), startMinutes: start, duration });
    else ok = await data.onCreateSick({ startMinutes: start });
    setPending(false);
    if (ok) router.back();
  };

  const ctaLabel = mode === 'lesson' ? 'Prenota' : mode === 'block' ? 'Blocca' : 'Registra malattia';

  const Chip = ({ value, label }: { value: Mode; label: string }) => (
    <Pressable onPress={() => setMode(value)} style={[s.pill, mode === value && s.pillActive]}>
      <Text style={[s.pillText, mode === value && s.pillTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.root}>
      <View style={s.closeRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn} disabled={pending}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      {data.allowBlock ? (
        <View style={s.chips}>
          <Chip value="lesson" label="Guida" />
          <Chip value="block" label="Blocca slot" />
          <Chip value="sick" label="Malattia" />
        </View>
      ) : null}

      <Text style={s.dayLabel}>
        {data.date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}
      </Text>
      <View style={s.timeHeadRow}>
        <Text style={s.timeValue}>
          {fmt(start)}
          {mode === 'sick' ? (
            <Text style={s.timeEnd}>{'  →  fine giornata'}</Text>
          ) : (
            <Text style={s.timeEnd}>{'  –  '}{fmt(endMinutes)}</Text>
          )}
        </Text>
      </View>

      <DateTimePicker
        mode="time"
        display="spinner"
        value={pickerValue}
        minuteInterval={15}
        onChange={onPickTime}
        style={s.spinner}
      />

      {mode === 'lesson' ? (
        <>
          <Text style={s.fieldLabel}>Allievo</Text>
          <View style={{ marginBottom: 16 }}>
            <SearchableSelect
              placeholder="Seleziona allievo…"
              value={studentId}
              options={data.studentOptions}
              onChange={setStudentId}
            />
          </View>
          <Text style={s.fieldLabel}>Durata</Text>
          <View style={s.durRow}>
            {fittingDurations.map((d) => {
              const aSel = duration === d;
              return (
                <Pressable key={d} onPress={() => setDuration(d)} style={[s.durChip, aSel && s.durChipActive]}>
                  <Text style={[s.durChipText, aSel && s.durChipTextActive]}>{d} min</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : mode === 'block' ? (
        <>
          <Text style={s.fieldLabel}>Durata</Text>
          <View style={[s.durRow, { marginBottom: 16 }]}>
            {fittingDurations.map((d) => {
              const aSel = duration === d;
              return (
                <Pressable key={d} onPress={() => setDuration(d)} style={[s.durChip, aSel && s.durChipActive]}>
                  <Text style={[s.durChipText, aSel && s.durChipTextActive]}>{d} min</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.fieldLabel}>Motivo (opzionale)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Es. pausa, manutenzione…"
            placeholderTextColor={colors.textMuted}
            style={s.reason}
          />
        </>
      ) : (
        <View style={s.sickNote}>
          <Ionicons name="medkit-outline" size={18} color="#EA580C" />
          <Text style={s.sickNoteText}>Sarai segnato in malattia dalle {fmt(start)} a fine giornata. Le guide in quella fascia verranno cancellate e gli allievi avvisati.</Text>
        </View>
      )}

      <Pressable
        onPress={confirm}
        disabled={!canConfirm}
        style={({ pressed }) => [s.cta, pressed && { opacity: 0.9 }, !canConfirm && { opacity: 0.4 }]}
      >
        {pending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>{ctaLabel}</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 12, paddingHorizontal: spacing.lg, paddingBottom: 28 },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: 4 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: '#EEF0F3' },
  pillActive: { backgroundColor: '#1A1A2E' },
  pillText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '600' },

  dayLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'capitalize', marginTop: 6 },
  timeHeadRow: { marginTop: 2 },
  timeValue: { fontSize: 26, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.5 },
  timeEnd: { fontSize: 16, fontWeight: '500', color: '#94A3B8' },
  spinner: { alignSelf: 'stretch', ...(Platform.OS === 'ios' ? { height: 170 } : {}), marginBottom: 6 },

  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  durRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  durChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  durChipText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  durChipTextActive: { color: '#FFFFFF' },

  reason: {
    backgroundColor: '#F7F7F8', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1A1A2E',
  },

  sickNote: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FFF7ED', borderRadius: 16, borderWidth: 1, borderColor: '#FED7AA', padding: 14,
  },
  sickNoteText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#9A3412', lineHeight: 19 },

  cta: {
    minHeight: 54, borderRadius: 27, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center', marginTop: 18,
    shadowColor: '#1A1A2E', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
