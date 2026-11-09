import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FormSheet } from '../../src/components/SheetScaffold';
import { ClayList, ClayListRow, ClaySearchField, markClayRow } from '../../src/components/clay';
import { CLAY } from '../../src/theme/clay';
import { countryPickerStore } from '../../src/stores/countryPickerStore';
import { PHONE_COUNTRIES, TOP_COUNTRIES, flagOf, type PhoneCountry } from '../../src/utils/phoneCountries';
import * as Haptics from '../../src/utils/haptics';

type Group = { key: string; title?: string; letter?: string; empty?: boolean; countries: PhoneCountry[] };

const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * «Prefisso» — il foglio del selettore paese di `PhoneField`: ricerca per nome
 * o per prefisso, i paesi più usati in cima, poi tutti per lettera. Il tocco
 * sceglie e chiude.
 */
export default function CountryPickerSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(countryPickerStore.subscribe, countryPickerStore.get);
  const [query, setQuery] = useState('');

  const pick = useCallback(
    (country: PhoneCountry) => {
      const current = countryPickerStore.get();
      Haptics.selectionAsync().catch(() => undefined);
      current?.onPick(country);
      router.back();
    },
    [router],
  );

  const groups = useMemo<Group[]>(() => {
    const q = fold(query.trim()).replace(/^\+/, '');
    if (q) {
      const hits = PHONE_COUNTRIES.filter((c) => (/^\d+$/.test(q) ? c.dial.startsWith(q) : fold(c.name).includes(q)));
      return hits.length
        ? [{ key: 'res', countries: hits }]
        : [{ key: 'none', empty: true, countries: [] }];
    }
    const out: Group[] = [{ key: 'top', title: 'Più usati', countries: TOP_COUNTRIES }];
    const byLetter = new Map<string, PhoneCountry[]>();
    for (const c of PHONE_COUNTRIES) {
      const letter = fold(c.name)[0].toUpperCase();
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), c]);
    }
    let first = true;
    for (const [letter, countries] of byLetter) {
      out.push({ key: `l-${letter}`, title: first ? 'Tutti i paesi' : undefined, letter, countries });
      first = false;
    }
    return out;
  }, [query]);

  if (!data) return <View style={s.blank} />;

  return (
    <FormSheet
      title="Prefisso"
      testID="country-picker-sheet"
      fixedTop={
        <ClaySearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Cerca paese o prefisso"
          autoCapitalize="none"
          style={s.search}
          testID="country-search"
        />
      }
      list={{
        data: groups,
        keyExtractor: (g: Group) => g.key,
        renderItem: ({ item }: { item: Group }) => (
          <GroupView group={item} selectedIso={data.selectedIso} onPick={pick} />
        ),
        extraData: data.selectedIso,
        initialNumToRender: 4,
        maxToRenderPerBatch: 4,
        windowSize: 7,
      }}
    />
  );
}

const GroupView = React.memo(function GroupView({
  group,
  selectedIso,
  onPick,
}: {
  group: Group;
  selectedIso: string;
  onPick: (c: PhoneCountry) => void;
}) {
  if (group.empty) return <Text style={s.none}>Nessun paese trovato.</Text>;
  return (
    <View>
      {group.title ? <Text style={s.section}>{group.title}</Text> : null}
      {group.letter ? <Text style={s.letter}>{group.letter}</Text> : null}
      <ClayList>
        {group.countries.map((c) => (
          <CountryRow key={c.iso} country={c} selected={c.iso === selectedIso} onPick={onPick} />
        ))}
      </ClayList>
    </View>
  );
});

const CountryRow = markClayRow(
  React.memo(function CountryRow({
    country,
    selected,
    onPick,
    divider,
    first,
    last,
  }: {
    country: PhoneCountry;
    selected: boolean;
    onPick: (c: PhoneCountry) => void;
    divider?: boolean;
    first?: boolean;
    last?: boolean;
  }) {
    return (
      <ClayListRow
        divider={divider}
        first={first}
        last={last}
        leading={
          <View style={s.flagBox}>
            <Text style={s.flag}>{flagOf(country.iso)}</Text>
          </View>
        }
        title={country.name}
        chevron={false}
        trailing={
          <View style={s.trailing}>
            <Text style={s.dial}>+{country.dial}</Text>
            <View style={s.check}>
              {selected ? <Ionicons name="checkmark" size={22} color={CLAY.ink} accessibilityLabel="Selezionato" /> : null}
            </View>
          </View>
        }
        onPress={() => onPick(country)}
        testID={`country-${country.iso}`}
      />
    );
  }),
);

const s = StyleSheet.create({
  blank: { backgroundColor: '#FFFFFF', height: 1 },
  search: { marginBottom: 6 },
  flagBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  flag: { fontSize: 28, lineHeight: 34 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dial: { fontSize: 16, color: CLAY.ink3, fontVariant: ['tabular-nums'] },
  check: { width: 22, alignItems: 'center' },
  section: { fontSize: 17, fontWeight: '600', color: CLAY.ink, paddingHorizontal: 4, paddingTop: 22, paddingBottom: 10, letterSpacing: -0.2 },
  letter: { fontSize: 13, fontWeight: '600', color: CLAY.ink4, paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6 },
  none: { fontSize: 14.5, color: CLAY.ink3, paddingHorizontal: 4, paddingTop: 18 },
});
