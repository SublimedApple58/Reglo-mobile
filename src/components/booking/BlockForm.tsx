import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetScaffold } from '../SheetScaffold';
import { blockSheetStore } from '../../stores/blockSheetStore';
import { timePickerStore } from '../../stores/timePickerStore';
import { dayPickerStore } from '../../stores/dayPickerStore';
import { regloApi } from '../../services/regloApi';
import { ToggleSwitch } from '../ToggleSwitch';
import { Button } from '../Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const NAVY = '#1A1A2E';
const GREY = '#717171';
const MUTED = '#94A3B8';
const N50 = '#F4F5F9';

const WEEK_OPTIONS = [2, 4, 8, 12];

const pad2 = (n: number) => String(n).padStart(2, '0');

const normalizeToQuarter = (value: Date) => {
  const next = new Date(value);
  next.setSeconds(0, 0);
  const rounded = Math.ceil(next.getMinutes() / 15) * 15;
  if (rounded === 60) next.setHours(next.getHours() + 1, 0, 0, 0);
  else next.setMinutes(rounded, 0, 0);
  return next;
};

/** Build a Date on `isoDay` at `minutes` from midnight (for the gesture preset). */
const dateAtMinutes = (isoDay: string, minutes: number) => {
  const d = new Date(isoDay);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/* ───────── Flat row inside an elevated card (icon · label · value · chevron) ───────── */
const Row = ({ icon, label, value, onPress, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  value?: string | null; onPress: () => void; disabled?: boolean;
}) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }]}>
    <View style={s.rowIcon}><Ionicons name={icon} size={22} color={NAVY} /></View>
    <View style={s.rowBody}>
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
  </Pressable>
);

/* ───────── Shared block-slot form (used by the block-slot route + quick-book) ─────────
 * `embedded` hides the route header (title + X) so the parent — the quick-book
 * sheet — can render its own header (Airbnb segmented). `presetStartMinutes`
 * seeds the start time (end = +60') from the released-scrub position. */
export function BlockForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(blockSheetStore.subscribe, blockSheetStore.get);

  const [date, setDate] = useState<Date>(() => new Date());
  const [startTime, setStartTime] = useState<Date>(() => normalizeToQuarter(new Date()));
  const [endTime, setEndTime] = useState<Date>(() => { const e = normalizeToQuarter(new Date()); e.setMinutes(e.getMinutes() + 60); return e; });
  const [reason, setReason] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [pending, setPending] = useState(false);
  const reasonRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!data) return;
    const start = data.presetStartMinutes != null
      ? dateAtMinutes(data.initialDate, data.presetStartMinutes)
      : normalizeToQuarter(new Date());
    // Keep the grid ghost's exact duration for a block (no snap); default 60'.
    const end = new Date(start); end.setMinutes(end.getMinutes() + (data.presetDurationMinutes ?? 60));
    setDate(new Date(data.initialDate));
    setStartTime(start);
    setEndTime(end);
    setReason('');
    setRecurring(false);
    setRecurringWeeks(4);
    setPending(false);
  }, [data]);

  const invalidRange = useMemo(() => {
    const s2 = startTime.getHours() * 60 + startTime.getMinutes();
    const e2 = endTime.getHours() * 60 + endTime.getMinutes();
    return e2 <= s2;
  }, [startTime, endTime]);

  if (!data) return <View style={s.root} />;

  const openDatePicker = () => {
    dayPickerStore.set({
      selectedDate: toYMD(date), markedDates: new Set(), monthsBack: 0, monthsCount: 4,
      allowPast: false, title: 'Seleziona data', onSelect: (ymd) => setDate(fromYMD(ymd)),
    });
    router.push('/(tabs)/home/select-date');
  };

  const openTimePicker = (current: Date, onConfirm: (d: Date) => void) => {
    timePickerStore.set({ selectedTime: current, onConfirm });
    router.push('/(tabs)/home/time-picker');
  };

  // Non-optimistic: keep the sheet open with a button spinner, create the block(s)
  // (one, or N for recurring — the BE creates N offset by 1 week), refresh the
  // parent's agenda from the BE, then close.
  const confirm = () => {
    const startsAt = new Date(date); startsAt.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    const endsAt = new Date(date); endsAt.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    if (endsAt <= startsAt) { Alert.alert('Orario non valido', "L'ora di fine deve essere dopo l'inizio."); return; }
    const reasonVal = reason.trim() || null;
    setPending(true);
    void (async () => {
      try {
        await regloApi.createInstructorBlock({
          startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
          ...(reasonVal ? { reason: reasonVal } : {}),
          ...(recurring ? { recurring: true, recurringWeeks } : {}),
        });
        await data.onApplied();
        data.onDone('Slot bloccato.');
        router.back();
      } catch (err) {
        setPending(false);
        Alert.alert('Errore', err instanceof Error ? err.message : 'Errore nel blocco slot');
      }
    })();
  };

  const canConfirm = !pending && !invalidRange;

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }, { paddingBottom: insets.bottom + 14 }]}>
      {!embedded && (
        <View style={s.header}>
          <Text style={s.title}>Blocca slot</Text>
          <Pressable onPress={() => !pending && router.back()} hitSlop={10} disabled={pending} style={({ pressed }) => [s.close, pressed && { opacity: 0.5 }]}>
            <Ionicons name="close" size={20} color={NAVY} />
          </Pressable>
        </View>
      )}

      <SheetScaffold
        keyboardAware
        footer={
          <View style={s.footer}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
              <Text style={s.sumKey}>Riepilogo</Text>
              <Text style={s.sumVal} numberOfLines={1}>{fmtDay(date)}</Text>
              <Text style={s.sumSub} numberOfLines={1}>{fmtTime(startTime)}–{fmtTime(endTime)}{recurring ? ` · ${recurringWeeks} sett.` : ''}</Text>
            </View>
            <View style={{ flexShrink: 0 }}>
              <Button label="Blocca slot" tone="primary" loading={pending} disabled={!canConfirm} onPress={confirm} />
            </View>
          </View>
        }
      >
      {/* Giorno + orari */}
      <View style={s.group}>
        <Row icon="calendar-outline" label="Giorno" value={fmtDay(date)} onPress={openDatePicker} disabled={pending} />
        <View style={s.divider} />
        <Row icon="time-outline" label="Ora inizio" value={fmtTime(startTime)} onPress={() => openTimePicker(startTime, setStartTime)} disabled={pending} />
        <View style={s.divider} />
        <Row icon="time-outline" label="Ora fine" value={fmtTime(endTime)} onPress={() => openTimePicker(endTime, setEndTime)} disabled={pending} />
      </View>
      {invalidRange ? <Text style={s.warn}>L'ora di fine deve essere dopo l'inizio.</Text> : null}

      {/* Motivo — opzionale */}
      <Text style={s.fieldLabel}>Motivo <Text style={s.fieldOptional}>· facoltativo</Text></Text>
      <TextInput
        ref={reasonRef}
        style={s.textArea}
        value={reason}
        onChangeText={setReason}
        placeholder="Es. Visita medica, pausa…"
        placeholderTextColor={MUTED}
        editable={!pending}
        multiline
        textAlignVertical="top"
      />

      {/* Ripeti ogni settimana — optional banner */}
      <View style={s.optBanner}>
        <View style={s.optIcon}><Ionicons name="repeat-outline" size={18} color={NAVY} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.optTitle}>Ripeti ogni settimana</Text>
          <Text style={s.optSub}>Stesso giorno e orario</Text>
        </View>
        <ToggleSwitch value={recurring} onValueChange={setRecurring} disabled={pending} />
      </View>

      {recurring ? (
        <>
          <Text style={s.listCaption}>Per quante settimane</Text>
          <View style={s.weeksRow}>
            {WEEK_OPTIONS.map((w) => { const active = recurringWeeks === w; return (
              <Pressable key={w} onPress={() => setRecurringWeeks(w)} style={[s.weekPill, active && s.weekPillOn]} disabled={pending}>
                <Text style={[s.weekPillTxt, active && s.weekPillTxtOn]}>{w} sett.</Text>
              </Pressable>
            ); })}
          </View>
        </>
      ) : null}
      </SheetScaffold>
    </View>
  );
}

const ELEV = {
  shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
} as const;

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 14, gap: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: '600', color: NAVY, letterSpacing: -0.5 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF0F3', alignItems: 'center', justifyContent: 'center' },

  group: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, marginBottom: 14, ...ELEV },
  warn: { fontSize: 12.5, color: '#EF4444', fontWeight: '500', marginTop: -8, marginBottom: 12, marginLeft: 6 },

  /* motivo text area — looks like an editable field, not a tappable card */
  fieldLabel: { fontSize: 13, fontWeight: '600', color: NAVY, marginBottom: 8, marginLeft: 2 },
  fieldOptional: { fontSize: 13, fontWeight: '500', color: MUTED },
  textArea: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E4E7EE', borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, minHeight: 84, fontSize: 14, color: NAVY, marginBottom: 14 },

  /* optional banner */
  optBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: N50, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 14 },
  optIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 14, fontWeight: '600', color: NAVY },
  optSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },

  listCaption: { fontSize: 12, fontWeight: '600', color: MUTED, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2, marginBottom: 8, marginLeft: 6 },
  weeksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  weekPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#F1F2F4' },
  weekPillOn: { backgroundColor: NAVY },
  weekPillTxt: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  weekPillTxtOn: { color: '#FFFFFF' },

  /* row */
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 64 },
  rowIcon: { width: 26, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: NAVY },
  rowValue: { fontSize: 14, color: GREY },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EFF0F3' },

  /* footer */
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sumKey: { fontSize: 12, color: MUTED, fontWeight: '500' },
  sumVal: { fontSize: 15, fontWeight: '600', color: NAVY, marginTop: 2 },
  sumSub: { fontSize: 13, fontWeight: '500', color: GREY, marginTop: 1 },
});
