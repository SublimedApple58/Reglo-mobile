import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ClayList, ClayListRow, ClaySurface } from '../clay';
import { SettingCheckRow } from '../SettingsRows';
import { TimeWheel } from './TimeWheel';
import { fadeIn } from '../../screens/firstAccess/FirstAccessStepScreen';
import { CLAY } from '../../theme/clay';
import type {
  StudentAvailabilityBand,
  StudentBandKey,
  StudentRangeRules,
  StudentTimeRange,
} from '../../types/regloApi';
import {
  bandHours,
  bandRanges,
  bandsOf,
  mergeRanges,
  moveRange,
  preciseSeed,
  secondRange,
  wheelValues,
} from '../../utils/studentAvailability';

/**
 * REG-813 — le scelte di UN giorno, uguali nella domanda guidata e nel foglio
 * del giorno: le tre fasce rapide (mattina, pomeriggio, sera) e, sotto, «Un
 * orario preciso» con le rotelle «Dalle» / «Alle» e un eventuale secondo
 * orario. Le due vie si escludono: toccare una fascia torna alle fasce.
 *
 * Chi lo monta tiene gli orari del giorno (`ranges`, già fusi) e mette una
 * `key` per giorno: lo stato locale (via scelta, orari grezzi delle rotelle)
 * nasce dagli orari all'apertura.
 */
export function StudentDayChoice({
  ranges,
  bands,
  rules,
  onChange,
  testPrefix,
}: {
  ranges: StudentTimeRange[];
  bands: StudentAvailabilityBand[];
  rules: StudentRangeRules;
  onChange: (ranges: StudentTimeRange[]) => void;
  testPrefix: string;
}) {
  const keys = bandsOf(ranges, bands);
  const [precise, setPrecise] = useState(keys === null);
  // Orari come li mostrano le rotelle: non fusi, così un orario non sparisce mentre lo si sposta.
  const [raw, setRaw] = useState<StudentTimeRange[]>(() => (keys === null ? preciseSeed(ranges, rules) : []));
  const values = useMemo(() => wheelValues(rules), [rules]);
  const selected = precise ? [] : (keys ?? []);

  const emit = (next: StudentTimeRange[]) => {
    setRaw(next);
    onChange(mergeRanges(next));
  };

  const toggleBand = (key: StudentBandKey) => {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    setPrecise(false);
    setRaw([]);
    onChange(bandRanges(next, bands));
  };

  const togglePrecise = () => {
    if (precise) {
      setPrecise(false);
      setRaw([]);
      onChange([]);
      return;
    }
    setPrecise(true);
    emit(preciseSeed(ranges, rules));
  };

  const move = (index: number, edge: 'start' | 'end', value: number) =>
    emit(raw.map((r, i) => (i === index ? moveRange(r, edge, value, rules) : r)));

  return (
    <View>
      <ClayList>
        {bands.map((band) => (
          <SettingCheckRow
            key={band.key}
            title={band.label}
            subtitle={bandHours(band)}
            checked={selected.includes(band.key)}
            onPress={() => toggleBand(band.key)}
            testID={`${testPrefix}-band-${band.key}`}
          />
        ))}
        <SettingCheckRow
          title="Un orario preciso"
          subtitle={precise ? raw.map(bandHours).join(' · ') : 'Scegli tu da che ora a che ora'}
          checked={precise}
          onPress={togglePrecise}
          testID={`${testPrefix}-precise`}
        />
      </ClayList>
      {precise ? (
        <Animated.View entering={fadeIn}>
          {raw.map((range, index) => (
            <ClaySurface key={index} style={s.card} padded={false}>
              {raw.length > 1 ? (
                <View style={s.head}>
                  <Text style={s.title}>{index === 0 ? 'Primo orario' : 'Secondo orario'}</Text>
                  {index > 0 ? (
                    <Pressable
                      onPress={() => emit(raw.filter((_, i) => i !== index))}
                      hitSlop={10}
                      accessibilityRole="button"
                      testID={`${testPrefix}-remove-${index}`}
                    >
                      <Text style={s.remove}>Togli</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <View style={s.wheels}>
                <TimeWheel
                  label="Dalle"
                  values={values}
                  value={range.startMinutes}
                  onChange={(v) => move(index, 'start', v)}
                  testID={`${testPrefix}-from-${index}`}
                />
                <TimeWheel
                  label="Alle"
                  values={values}
                  value={range.endMinutes}
                  onChange={(v) => move(index, 'end', v)}
                  testID={`${testPrefix}-to-${index}`}
                />
              </View>
            </ClaySurface>
          ))}
          {raw.length < rules.maxPerDay ? (
            <ClayList style={s.gap}>
              <ClayListRow
                title="Aggiungi un altro orario"
                subtitle="Se sei libero in due momenti"
                onPress={() => emit([...raw, secondRange(raw[raw.length - 1], rules)])}
                testID={`${testPrefix}-add`}
              />
            </ClayList>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  gap: { marginTop: 14 },
  card: { marginTop: 14, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 14 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  remove: { fontSize: 14, fontWeight: '500', color: CLAY.ink3 },
  wheels: { flexDirection: 'row', gap: 10 },
});
