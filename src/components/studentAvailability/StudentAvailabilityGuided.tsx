import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import { ClayList, ClayListRow } from '../clay';
import { CLAY } from '../../theme/clay';
import { SettingCheckRow, SettingToggleRow } from '../SettingsRows';
import { StudentWeekStrip } from './StudentWeekStrip';
import { fadeIn, fadeOut } from '../../screens/firstAccess/FirstAccessStepScreen';
import { studentDayStore } from '../../stores/studentDayStore';
import type { StudentAvailabilityBand, StudentBandKey, StudentBandsByDay } from '../../types/regloApi';
import {
  WEEK,
  activeDays,
  bandHours,
  bandsText,
  everyBand,
  hoursText,
  isEveryBand,
  orderBands,
  type DayKey,
} from '../../utils/studentAvailability';


const sameKeys = (a: readonly StudentBandKey[] | undefined, b: readonly StudentBandKey[], bands: StudentAvailabilityBand[]) =>
  orderBands(a, bands).join() === orderBands(b, bands).join();

/** Le fasce «di solito» già scelte: quelle del giorno più ricorrente. */
function usualFrom(days: StudentBandsByDay, bands: StudentAvailabilityBand[]): StudentBandKey[] {
  const counts = new Map<string, { keys: StudentBandKey[]; n: number }>();
  for (const d of activeDays(days)) {
    const keys = orderBands(days[d.key], bands);
    const id = keys.join();
    counts.set(id, { keys, n: (counts.get(id)?.n ?? 0) + 1 });
  }
  let best: StudentBandKey[] = [];
  let max = 0;
  counts.forEach(({ keys, n }) => {
    if (n > max) {
      best = keys;
      max = n;
    }
  });
  return best;
}

/**
 * REG-802 giro 2 — la scelta GUIDATA delle disponibilità nell'onboarding (nel
 * Profilo resta `StudentAvailabilityEditor`). Una domanda alla volta, sulla
 * stessa schermata:
 *
 * 1. «Di solito sei libero…» — mattina / pomeriggio / sera con la spunta (o
 *    «Va bene qualsiasi orario»).
 * 2. «In quali giorni?» — compare dopo la prima fascia: la settimana diventa il
 *    comando, i giorni vuoti mostrano le fasce in trasparenza e un tocco le
 *    riempie (un altro le toglie).
 * 3. «Un giorno è diverso?» — i giorni scelti, uno per riga: il tocco apre il
 *    foglio del giorno per le eccezioni.
 *
 * Cambiare le fasce «di solito» aggiorna i giorni che le seguivano; quelli
 * cambiati a mano restano come sono.
 */
export const StudentAvailabilityGuided = memo(function StudentAvailabilityGuided({
  days,
  bands,
  onChange,
  dayHref,
  onNextQuestion,
}: {
  days: StudentBandsByDay;
  bands: StudentAvailabilityBand[];
  onChange: (days: StudentBandsByDay) => void;
  dayHref: Href;
  /** Compare «In quali giorni?»: chi lo monta la porta in vista. */
  onNextQuestion?: () => void;
}) {
  const router = useRouter();
  const latest = useRef(days);
  latest.current = days;
  const [usual, setUsual] = useState<StudentBandKey[]>(() => usualFrom(days, bands));
  const usualRef = useRef(usual);
  usualRef.current = usual;
  const beforeAll = useRef<{ days: StudentBandsByDay; usual: StudentBandKey[] } | null>(null);
  const all = isEveryBand(days, bands);
  const chosen = activeDays(days);
  const askDays = usual.length > 0 || chosen.length > 0;
  const asked = useRef(askDays);
  useEffect(() => {
    if (askDays && !asked.current) onNextQuestion?.();
    asked.current = askDays;
  }, [askDays, onNextQuestion]);

  const setUsualBands = (next: StudentBandKey[]) => {
    const prev = usualRef.current;
    const ordered = orderBands(next, bands);
    // I giorni che seguivano le fasce «di solito» le seguono ancora.
    const updated: StudentBandsByDay = { ...latest.current };
    for (const d of activeDays(latest.current)) {
      if (sameKeys(latest.current[d.key], prev, bands)) updated[d.key] = ordered;
    }
    beforeAll.current = null;
    setUsual(ordered);
    onChange(updated);
  };

  const openDay = useCallback(
    (day: DayKey) => {
      const meta = WEEK.find((d) => d.key === day)!;
      studentDayStore.set({
        dayLabel: meta.full,
        bands,
        selected: latest.current[day] ?? [],
        onDone: (selected, applyAll) => {
          beforeAll.current = null;
          if (applyAll) {
            setUsual(orderBands(selected, bands));
            onChange(Object.fromEntries(WEEK.map((d) => [d.key, selected])) as StudentBandsByDay);
          } else {
            onChange({ ...latest.current, [day]: selected });
          }
        },
      });
      router.push(dayHref);
    },
    [bands, dayHref, onChange, router],
  );

  const toggleDay = (day: DayKey) => {
    const on = (latest.current[day]?.length ?? 0) > 0;
    beforeAll.current = null;
    if (on) {
      onChange({ ...latest.current, [day]: [] });
    } else if (usualRef.current.length) {
      onChange({ ...latest.current, [day]: usualRef.current });
    } else {
      openDay(day);
    }
  };

  return (
    <View>
      <Text style={s.question}>Di solito sei libero…</Text>
      <ClayList>
        {bands.map((band) => (
          <SettingCheckRow
            key={band.key}
            title={band.label}
            subtitle={bandHours(band)}
            checked={usual.includes(band.key)}
            onPress={() =>
              setUsualBands(usual.includes(band.key) ? usual.filter((k) => k !== band.key) : [...usual, band.key])
            }
            testID={`guided-band-${band.key}`}
          />
        ))}
      </ClayList>
      <ClayList style={s.gap}>
        <SettingToggleRow
          title="Va bene qualsiasi orario"
          subtitle="Tutti i giorni, dalle 8 alle 21"
          value={all}
          onValueChange={(on) => {
            if (on) {
              beforeAll.current = { days: latest.current, usual: usualRef.current };
              setUsual(bands.map((b) => b.key));
              onChange(everyBand(bands));
            } else {
              const back = beforeAll.current;
              beforeAll.current = null;
              setUsual(back?.usual ?? []);
              onChange(back?.days ?? {});
            }
          }}
          testID="student-availability-any"
        />
      </ClayList>

      {askDays ? (
        <Animated.View entering={fadeIn}>
          <Text style={[s.question, s.next]}>In quali giorni?</Text>
          <Text style={s.hint}>
            {chosen.length
              ? 'Tocca un giorno per aggiungerlo o toglierlo.'
              : usual.length
                ? `Tocca i giorni in cui puoi: si riempiono con ${bandsText(usual, bands)!.toLowerCase()}.`
                : 'Tocca un giorno per scegliere le fasce.'}
          </Text>
          <StudentWeekStrip
            days={days}
            bands={bands}
            ghost={usual}
            quietEmpty
            onPressDay={toggleDay}
            pressLabel={(day, on) => `${day}, ${on ? 'togli' : 'aggiungi'}`}
          />
        </Animated.View>
      ) : null}

      {chosen.length ? (
        <Animated.View entering={fadeIn} exiting={fadeOut}>
          <Text style={[s.question, s.next]}>Un giorno è diverso?</Text>
          <Text style={s.hint}>Toccalo per cambiare le fasce solo per quel giorno.</Text>
          <ClayList>
            {chosen.map((d) => (
              <ClayListRow
                key={d.key}
                title={d.full}
                subtitle={`${bandsText(days[d.key], bands)} · ${hoursText(days[d.key], bands)}`}
                onPress={() => openDay(d.key)}
                testID={`student-availability-day-${d.key}`}
              />
            ))}
          </ClayList>
        </Animated.View>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  question: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, marginBottom: 10, paddingHorizontal: 2 },
  next: { marginTop: 28, marginBottom: 4 },
  hint: { fontSize: 14.5, lineHeight: 20, color: CLAY.ink3, marginBottom: 12, paddingHorizontal: 2 },
  gap: { marginTop: 14 },
});
