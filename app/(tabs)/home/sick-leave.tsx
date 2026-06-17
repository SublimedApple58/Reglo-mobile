import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetScaffold } from '../../../src/components/SheetScaffold';

import { sickLeaveSheetStore } from '../../../src/stores/sickLeaveSheetStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { dayPickerStore } from '../../../src/stores/dayPickerStore';
import { dateRangeStore } from '../../../src/stores/dateRangeStore';
import { regloApi } from '../../../src/services/regloApi';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
import { Button } from '../../../src/components/Button';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const NAVY = '#1A1A2E';
const GREY = '#717171';
const MUTED = '#94A3B8';
const N50 = '#F4F5F9';

const pad2 = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const sameYMD = (a: Date, b: Date) => toYMD(a) === toYMD(b);

/* ───────── Flat row inside an elevated card (icon · label · value · chevron) ───────── */
const Row = ({ icon, label, value, valueSub, onPress, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  value?: string | null; valueSub?: string | null; onPress: () => void; disabled?: boolean;
}) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }]}>
    <View style={s.rowIcon}><Ionicons name={icon} size={22} color={NAVY} /></View>
    <View style={s.rowBody}>
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
      {valueSub ? <Text style={s.rowValueSub} numberOfLines={1}>{valueSub}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
  </Pressable>
);

/* ───────── Route — native content-hugging formSheet ───────── */
export default function SickLeaveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(sickLeaveSheetStore.subscribe, sickLeaveSheetStore.get);

  const [startDate, setStartDate] = useState<Date>(() => new Date());
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [multiDay, setMultiDay] = useState(false);
  const [halfDay, setHalfDay] = useState(false);
  const [startTime, setStartTime] = useState<Date>(() => { const t = new Date(); t.setHours(14, 0, 0, 0); return t; });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!data) return;
    const d = new Date(data.initialDate);
    const t = new Date(); t.setHours(14, 0, 0, 0);
    setStartDate(d);
    setEndDate(d);
    setMultiDay(false);
    setHalfDay(false);
    setStartTime(t);
    setPending(false);
  }, [data]);

  const invalidRange = useMemo(
    () => multiDay && fromYMD(toYMD(endDate)).getTime() < fromYMD(toYMD(startDate)).getTime(),
    [multiDay, startDate, endDate],
  );

  if (!data) return <View style={s.root} />;

  const openDatePicker = (current: Date, onSelect: (d: Date) => void) => {
    dayPickerStore.set({
      selectedDate: toYMD(current), markedDates: new Set(), monthsBack: 0, monthsCount: 4,
      allowPast: false, title: 'Seleziona data', onSelect: (ymd) => onSelect(fromYMD(ymd)),
    });
    router.push('/(tabs)/home/select-date');
  };

  const openTimePicker = () => {
    timePickerStore.set({ selectedTime: startTime, onConfirm: setStartTime });
    router.push('/(tabs)/home/time-picker');
  };

  const openRangePicker = () => {
    dateRangeStore.set({
      from: toYMD(startDate),
      to: toYMD(endDate),
      title: 'Periodo di malattia',
      minISO: toYMD(new Date()),
      onApply: (from, to) => { setStartDate(fromYMD(from)); setEndDate(fromYMD(to)); },
    });
    router.push('/(tabs)/home/select-date-range');
  };

  const setMulti = (val: boolean) => {
    setMultiDay(val);
    if (!val) setEndDate(startDate);
  };

  const rangeDays = Math.round((fromYMD(toYMD(endDate)).getTime() - fromYMD(toYMD(startDate)).getTime()) / 86400000) + 1;

  // Non-optimistic: keep the sheet open with a button spinner, register the sick
  // leave (the BE creates the block(s) and cancels the overlapping guides), then
  // refresh the parent's agenda from the BE so the cancelled guides drop out, and
  // close.
  const confirm = () => {
    if (invalidRange) { Alert.alert('Periodo non valido', 'La data di fine deve essere uguale o successiva a quella di inizio.'); return; }
    setPending(true);
    void (async () => {
      try {
        const result = await regloApi.createInstructorSickLeave({
          startDate: toYMD(startDate),
          endDate: toYMD(multiDay ? endDate : startDate),
          ...(halfDay ? { startTime: fmtTime(startTime) } : {}),
        });
        await data.onApplied();
        data.onDone(`Malattia registrata. ${result.appointmentsCancelled} guide cancellate.`);
        router.back();
      } catch (err) {
        setPending(false);
        Alert.alert('Errore', err instanceof Error ? err.message : 'Errore nella registrazione malattia');
      }
    })();
  };

  const summaryMain = multiDay && !sameYMD(startDate, endDate)
    ? `${fmtDay(startDate)} – ${fmtDay(endDate)}`
    : fmtDay(startDate);
  const summarySub = halfDay ? `Dalle ${fmtTime(startTime)}` : 'Tutto il giorno';

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 14 }, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.header}>
        <Text style={s.title}>Registra malattia</Text>
        <Pressable onPress={() => !pending && router.back()} hitSlop={10} disabled={pending} style={({ pressed }) => [s.close, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>
      <SheetScaffold
        footer={(
          <View style={s.footer}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
              <Text style={s.sumKey}>Riepilogo</Text>
              <Text style={s.sumVal} numberOfLines={1}>{summaryMain}</Text>
              <Text style={s.sumSub} numberOfLines={1}>{summarySub}</Text>
            </View>
            <View style={{ flexShrink: 0 }}>
              <Button label="Conferma malattia" tone="primary" loading={pending} disabled={pending || invalidRange} onPress={confirm} />
            </View>
          </View>
        )}
      >
      <Text style={s.lead}>Le guide in conflitto verranno cancellate.</Text>

      {/* Date — singolo giorno o periodo (un solo calendario range) */}
      <View style={s.group}>
        {!multiDay ? (
          <Row icon="calendar-outline" label="Giorno" value={fmtDay(startDate)} onPress={() => openDatePicker(startDate, (d) => { setStartDate(d); setEndDate(d); })} disabled={pending} />
        ) : (
          <Row
            icon="calendar-outline"
            label="Periodo"
            value={sameYMD(startDate, endDate) ? fmtDay(startDate) : `${fmtDay(startDate)} – ${fmtDay(endDate)}`}
            valueSub={`${rangeDays} giorn${rangeDays === 1 ? 'o' : 'i'}`}
            onPress={openRangePicker}
            disabled={pending}
          />
        )}
      </View>

      {/* Più giorni — optional banner */}
      <View style={s.optBanner}>
        <View style={s.optIcon}><Ionicons name="layers-outline" size={18} color={NAVY} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.optTitle}>Più giorni</Text>
          <Text style={s.optSub}>Imposta un periodo di malattia</Text>
        </View>
        <ToggleSwitch value={multiDay} onValueChange={setMulti} disabled={pending} />
      </View>

      {/* Mezza giornata — optional banner */}
      <View style={s.optBanner}>
        <View style={s.optIcon}><Ionicons name="time-outline" size={18} color={NAVY} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.optTitle}>Mezza giornata</Text>
          <Text style={s.optSub}>Inizia a un orario specifico</Text>
        </View>
        <ToggleSwitch value={halfDay} onValueChange={setHalfDay} disabled={pending} />
      </View>

      {halfDay ? (
        <View style={s.group}>
          <Row icon="time-outline" label="Orario di inizio" value={fmtTime(startTime)} onPress={openTimePicker} disabled={pending} />
        </View>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 6, gap: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: '600', color: NAVY, letterSpacing: -0.5 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF0F3', alignItems: 'center', justifyContent: 'center' },
  lead: { fontSize: 14, color: GREY, marginBottom: 16 },

  group: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, marginBottom: 14, ...ELEV },

  optBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: N50, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 14 },
  optIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 14, fontWeight: '600', color: NAVY },
  optSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 64 },
  rowIcon: { width: 26, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: NAVY },
  rowValue: { fontSize: 14, color: GREY },
  rowValueSub: { fontSize: 13, color: '#9CA3AF' },

  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sumKey: { fontSize: 12, color: MUTED, fontWeight: '500' },
  sumVal: { fontSize: 15, fontWeight: '600', color: NAVY, marginTop: 2 },
  sumSub: { fontSize: 13, fontWeight: '500', color: GREY, marginTop: 1 },
});
