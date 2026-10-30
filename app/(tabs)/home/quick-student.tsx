import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayList, ClayListRow, ClaySearchField, markClayRow } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';
import { bookingSheetStore } from '../../../src/stores/bookingSheetStore';
import { matchesPersonSearch } from '../../../src/utils/peopleSearch';

type Person = { id: string; name: string; detail: string | null; sortKey: string };

type Group = {
  key: string;
  title?: string;
  letter?: string;
  empty?: boolean;
  people: Person[];
};

/** Fino a quanti allievi «Tutti» resta una card sola. */
const ONE_CARD_MAX = 20;

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtMin = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

/**
 * REG-671 — «Con chi guidi?»: primo foglio della Guida creata dal blocco
 * fantasma dell'agenda. Ricerca in cima, «Suggeriti» (calcolati dall'agenda già
 * in memoria: esame vicino, nessuna guida in agenda, ultima guida con te) e poi
 * tutti gli allievi prenotabili in ordine alfabetico, divisi per lettera. La
 * lista è la FlatList del foglio (`FormSheet list`): regge centinaia di allievi.
 * Il tocco spinge sopra il riepilogo «Guida con <nome>»; trascinandolo giù si
 * torna qui. Nessuna chiamata di rete: i dati li semina l'agenda.
 */
export default function QuickStudentSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(bookingSheetStore.subscribe, bookingSheetStore.get);
  const [query, setQuery] = useState('');

  const options = data?.studentOptions;
  const byId = useMemo(() => new Map((options ?? []).map((o) => [o.value, o])), [options]);

  const everyone: Person[] = useMemo(
    () =>
      (options ?? [])
        .map((o) => ({
          id: o.value,
          name: o.label,
          detail: [o.licenseCategory ? `Patente ${o.licenseCategory}` : null, o.subtitle].filter(Boolean).join(' · ') || null,
          sortKey: o.label.toLocaleLowerCase('it'),
        }))
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'it')),
    [options],
  );

  const suggested: Person[] = useMemo(
    () =>
      (data?.suggestions ?? [])
        .filter((x) => byId.has(x.id))
        .slice(0, 3)
        .map((x) => ({ id: x.id, name: byId.get(x.id)!.label, detail: x.reason, sortKey: '' })),
    [data?.suggestions, byId],
  );

  const pick = useCallback(
    (id: string) => {
      const current = bookingSheetStore.get();
      if (!current) return;
      Haptics.selectionAsync().catch(() => undefined);
      bookingSheetStore.set({ ...current, presetStudentId: id });
      router.push('/(tabs)/home/quick-guide');
    },
    [router],
  );

  if (!data) return <View style={s.blank} />;

  const dur = data.durations.length
    ? data.durations.reduce((best, d) => (Math.abs(d - data.defaultDuration) < Math.abs(best - data.defaultDuration) ? d : best), data.durations[0])
    : data.defaultDuration;
  const day = new Date(data.initialDate).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const start = data.presetStartMinutes ?? 0;
  const subtitle = `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${fmtMin(start)} – ${fmtMin(start + dur)}`;

  const q = query.trim();
  const shown = q ? everyone.filter((p) => matchesPersonSearch(p.name, q)) : everyone;
  const groups: Group[] = [];
  if (!q && suggested.length) groups.push({ key: 'sugg', title: 'Suggeriti', people: suggested });
  if (q) {
    groups.push({ key: 'res', title: `Risultati · ${shown.length}`, empty: !shown.length, people: [] });
    if (shown.length) groups.push({ key: 'res-list', people: shown });
  } else {
    // Pochi allievi: una card sola (come l'anteprima); tanti: card per lettera,
    // così la FlatList virtualizza e la lista resta fluida con centinaia di nomi.
    if (shown.length <= ONE_CARD_MAX) {
      groups.push({ key: 'all', title: 'Tutti', empty: !shown.length, people: shown });
    } else {
      groups.push({ key: 'all', title: 'Tutti', people: [] });
      for (const [letter, people] of byLetter(shown)) groups.push({ key: `l-${letter}`, letter, people });
    }
  }

  return (
    <FormSheet
      title="Con chi guidi?"
      subtitle={subtitle}
      testID="quick-student-sheet"
      list={{
        data: groups,
        keyExtractor: (g: Group) => g.key,
        renderItem: ({ item }: { item: Group }) => <GroupView group={item} onPick={pick} />,
        initialNumToRender: 4,
        maxToRenderPerBatch: 3,
        windowSize: 7,
      }}
    >
      <ClaySearchField
        value={query}
        onChangeText={setQuery}
        placeholder={`Cerca tra ${everyone.length} allievi`}
        autoCapitalize="words"
        testID="quick-student-search"
      />
    </FormSheet>
  );
}

/** Raggruppa per iniziale (come «Tutti gli allievi» di Road). */
function byLetter(people: Person[]): Array<[string, Person[]]> {
  const groups = new Map<string, Person[]>();
  for (const p of people) {
    const letter = p.sortKey[0]?.toUpperCase() ?? '#';
    const arr = groups.get(letter);
    if (arr) arr.push(p);
    else groups.set(letter, [p]);
  }
  return [...groups.entries()];
}

const GroupView = React.memo(function GroupView({ group, onPick }: { group: Group; onPick: (id: string) => void }) {
  if (!group.people.length) {
    return (
      <View>
        {group.title ? <Text style={s.section}>{group.title}</Text> : null}
        {group.empty ? <Text style={s.none}>Nessun allievo trovato.</Text> : null}
      </View>
    );
  }
  return (
    <View>
      {group.title ? <Text style={s.section}>{group.title}</Text> : null}
      {group.letter ? <Text style={s.letter}>{group.letter}</Text> : null}
      <ClayList>
        {group.people.map((p) => (
          <PersonRow key={p.id} person={p} onPick={onPick} />
        ))}
      </ClayList>
    </View>
  );
});

const PersonRow = markClayRow(
  React.memo(function PersonRow({
    person,
    onPick,
    divider,
    first,
    last,
  }: {
    person: Person;
    onPick: (id: string) => void;
    divider?: boolean;
    first?: boolean;
    last?: boolean;
  }) {
    return (
      <ClayListRow
        divider={divider}
        first={first}
        last={last}
        leading={<Avatar userId={person.id} name={person.name} size={42} />}
        title={person.name}
        subtitle={person.detail ?? undefined}
        chevron={false}
        onPress={() => onPick(person.id)}
        testID="quick-student-row"
      />
    );
  }),
);

const s = StyleSheet.create({
  blank: { backgroundColor: '#FFFFFF', height: 1 },
  section: { fontSize: 17, fontWeight: '600', color: CLAY.ink, paddingHorizontal: 4, paddingTop: 22, paddingBottom: 10, letterSpacing: -0.2 },
  letter: { fontSize: 13, fontWeight: '600', color: CLAY.ink4, paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6 },
  none: { fontSize: 14.5, color: CLAY.ink3, paddingHorizontal: 4, paddingTop: 4 },
});
