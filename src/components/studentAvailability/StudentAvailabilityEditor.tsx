import React, { memo, useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ClayList, ClayListRow } from '../clay';
import { CLAY } from '../../theme/clay';
import { SettingToggleRow } from '../SettingsRows';
import { StudentWeekStrip } from './StudentWeekStrip';
import { studentDayStore } from '../../stores/studentDayStore';
import type { StudentAvailabilityBand, StudentRangeRules, StudentRangesByDay } from '../../types/regloApi';
import { DEFAULT_RULES, WEEK, dayText, everyBand, isEveryBand, sameForAll, type DayKey } from '../../utils/studentAvailability';

/**
 * REG-802 — l'editor delle disponibilità dell'allievo: la settimana in alto
 * (protagonista), «Va bene qualsiasi orario», poi i sette giorni come righe che
 * aprono il foglio del giorno. Lo usano lo step dell'onboarding e
 * Profilo › Disponibilità; i dati li tiene chi lo monta.
 */
export const StudentAvailabilityEditor = memo(function StudentAvailabilityEditor({
  days,
  bands,
  rules = DEFAULT_RULES,
  onChange,
  dayHref,
}: {
  days: StudentRangesByDay;
  bands: StudentAvailabilityBand[];
  /** REG-813 — regole di «Un orario preciso». */
  rules?: StudentRangeRules;
  onChange: (days: StudentRangesByDay) => void;
  /** Rotta del foglio del giorno nello stack corrente. */
  dayHref: Href;
}) {
  const router = useRouter();
  const latest = useRef(days);
  latest.current = days;
  // «Qualsiasi orario» spento torna alle scelte di prima.
  const beforeAll = useRef<StudentRangesByDay | null>(null);
  const all = isEveryBand(days, bands);

  const openDay = useCallback(
    (day: DayKey) => {
      const meta = WEEK.find((d) => d.key === day)!;
      studentDayStore.set({
        dayLabel: meta.full,
        bands,
        rules,
        ranges: latest.current[day] ?? [],
        onDone: (ranges, applyAll) => {
          const next: StudentRangesByDay = applyAll ? sameForAll(ranges) : { ...latest.current, [day]: ranges };
          beforeAll.current = null;
          onChange(next);
        },
      });
      router.push(dayHref);
    },
    [bands, rules, dayHref, onChange, router],
  );

  return (
    <View>
      <StudentWeekStrip days={days} bands={bands} onPressDay={openDay} />
      <ClayList style={s.any}>
        <SettingToggleRow
          title="Va bene qualsiasi orario"
          subtitle="Tutti i giorni, dalle 8 alle 21"
          value={all}
          onValueChange={(on) => {
            if (on) {
              beforeAll.current = latest.current;
              onChange(everyBand(bands));
            } else {
              onChange(beforeAll.current ?? {});
              beforeAll.current = null;
            }
          }}
          testID="student-availability-any"
        />
      </ClayList>
      <ClayList style={s.days}>
        {WEEK.map((d) => (
          <ClayListRow
            key={d.key}
            title={d.full}
            subtitle={dayText(days[d.key], bands) ?? <NotAvailable />}
            onPress={() => openDay(d.key)}
            testID={`student-availability-day-${d.key}`}
          />
        ))}
      </ClayList>
    </View>
  );
});

/** «Non disponibile» più tenue delle fasce scelte. */
export const NotAvailable = () => (
  <Text style={s.none} numberOfLines={1}>
    Non disponibile
  </Text>
);

const s = StyleSheet.create({
  none: { flexShrink: 1, fontSize: 13.5, color: CLAY.ink4 },
  any: { marginTop: 14 },
  days: { marginTop: 14 },
});
