import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow, ClayToggle } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';
import { VITA_ART } from '../../../src/theme/vitaArt';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../../src/utils/motion';

import { sickLeaveSheetStore } from '../../../src/stores/sickLeaveSheetStore';
import { timePickerStore } from '../../../src/stores/timePickerStore';
import { dayPickerStore } from '../../../src/stores/dayPickerStore';
import { dateRangeStore } from '../../../src/stores/dateRangeStore';
import { regloApi } from '../../../src/services/regloApi';

const pad2 = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const sameYMD = (a: Date, b: Date) => toYMD(a) === toYMD(b);


/* ───────── Route — il form sheet unico (FORM_SHEET + FormSheet, REG-639 clay) ───────── */
export default function SickLeaveScreen() {
  const router = useRouter();
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

  if (!data) return <View style={s.empty} />;

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

  // Mentre registra il modulo è fermo: le righe non aprono nulla.
  const guard = (fn: () => void) => () => { if (!pending) fn(); };

  return (
    <FormSheet
      title="Malattia"
      subtitle={`${summaryMain} · ${summarySub}`}
      onClose={() => { if (!pending) router.back(); }}
      busy={pending}
      testID="sick-leave-sheet"
      cta={
        <ClayButton
          title="Conferma malattia"
          loading={pending}
          disabled={pending || invalidRange}
          onPress={confirm}
          testID="sick-leave-submit"
        />
      }
    >
      {/* REG-639 «vita»: il termometro 3D e una frase gentile. */}
      <View style={s.hero}>
        <Image source={VITA_ART.termometro} style={s.heroArt} />
        <Text style={s.lead}>Riguardati. Le guide in conflitto vengono annullate e gli allievi avvisati.</Text>
      </View>

      {/* Date — singolo giorno o periodo (un solo calendario range) */}
      <ClayList>
        {!multiDay ? (
          <ClayListRow
            title="Giorno"
            subtitle={fmtDay(startDate)}
            onPress={guard(() => openDatePicker(startDate, (d) => { setStartDate(d); setEndDate(d); }))}
          />
        ) : (
          <ClayListRow
            title="Periodo"
            subtitle={`${sameYMD(startDate, endDate) ? fmtDay(startDate) : `${fmtDay(startDate)} – ${fmtDay(endDate)}`} · ${rangeDays} giorn${rangeDays === 1 ? 'o' : 'i'}`}
            onPress={guard(openRangePicker)}
          />
        )}
      </ClayList>

      <ClayList style={s.gap}>
        <ClayListRow
          title="Più giorni"
          subtitle="Imposta un periodo di malattia"
          trailing={<ClayToggle value={multiDay} onValueChange={setMulti} disabled={pending} accessibilityLabel="Più giorni" testID="sick-multi-toggle" />}
        />
        <ClayListRow
          title="Mezza giornata"
          subtitle="Inizia a un orario specifico"
          trailing={<ClayToggle value={halfDay} onValueChange={setHalfDay} disabled={pending} accessibilityLabel="Mezza giornata" testID="sick-half-toggle" />}
        />
        {halfDay ? <SoftRow title="Orario di inizio" subtitle={fmtTime(startTime)} onPress={guard(openTimePicker)} /> : null}
      </ClayList>
    </FormSheet>
  );
}

/** Riga che compare/sparisce in dissolvenza, mai di botto. */
function SoftRow(props: React.ComponentProps<typeof ClayListRow>) {
  return (
    <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
      <ClayListRow {...props} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  hero: { alignItems: 'center', marginBottom: 18 },
  heroArt: { width: 84, height: 84 },
  lead: { fontSize: 15.5, lineHeight: 21, color: CLAY.ink2, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
  gap: { marginTop: 22 },
});
