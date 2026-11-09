import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayList, ClayListRow, ClaySearchField, markClayRow } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';
import {
  agendaScopeSheetStore,
  sameScope,
  type AgendaScope,
  type AgendaScopeInstructor,
} from '../../../src/stores/agendaScopeSheetStore';
import { matchesPersonSearch } from '../../../src/utils/peopleSearch';
import * as Haptics from '../../../src/utils/haptics';

type Group = { key: string; title?: string; letter?: string; empty?: boolean; people: AgendaScopeInstructor[] };

/** Fino a quanti istruttori la lista resta una card sola. */
const ONE_CARD_MAX = 20;
/** Sotto questa soglia la ricerca non serve. */
const SEARCH_MIN = 7;

/**
 * «Quale agenda?» (09/11/2026) — il filtro dell'Agenda per titolare e
 * titolare-istruttore: «Le mie guide» (solo chi è anche istruttore), «Tutti gli
 * istruttori» e poi ogni istruttore, con ricerca e lettere quando sono tanti.
 * La lista è la FlatList del foglio (`FormSheet list`), righe memo. Nessuna
 * chiamata di rete: gli istruttori li semina l'agenda dal suo bootstrap. Il
 * tocco applica e chiude; l'agenda filtra i dati che ha già.
 */
export default function AgendaScopeSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(agendaScopeSheetStore.subscribe, agendaScopeSheetStore.get);
  const [query, setQuery] = useState('');

  const others = useMemo(
    () =>
      (data?.instructors ?? [])
        .filter((i) => i.id !== data?.myInstructorId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [data?.instructors, data?.myInstructorId],
  );

  const pick = useCallback(
    (scope: AgendaScope) => {
      const current = agendaScopeSheetStore.get();
      if (!current) return;
      Haptics.selectionAsync().catch(() => undefined);
      if (!sameScope(scope, current.selected)) current.onPick(scope);
      router.back();
    },
    [router],
  );
  const pickInstructor = useCallback((id: string) => pick({ kind: 'instructor', instructorId: id }), [pick]);

  if (!data) return <View style={s.blank} />;

  const selectedId = data.selected.kind === 'instructor' ? data.selected.instructorId : null;
  const q = query.trim();
  const shown = q ? others.filter((p) => matchesPersonSearch(p.name, q)) : others;
  const groups: Group[] = [];
  if (q) {
    groups.push({ key: 'res', title: `Risultati · ${shown.length}`, empty: !shown.length, people: [] });
    if (shown.length) groups.push({ key: 'res-list', people: shown });
  } else if (shown.length <= ONE_CARD_MAX) {
    if (shown.length) groups.push({ key: 'all', title: 'Istruttori', people: shown });
  } else {
    groups.push({ key: 'all', title: 'Istruttori', people: [] });
    for (const [letter, people] of byLetter(shown)) groups.push({ key: `l-${letter}`, letter, people });
  }

  const check = <Ionicons name="checkmark" size={22} color={CLAY.ink} accessibilityLabel="Selezionato" />;
  const n = data.instructors.length;

  return (
    <FormSheet
      title="Quale agenda?"
      subtitle={`${n} ${n === 1 ? 'istruttore' : 'istruttori'}`}
      testID="agenda-scope-sheet"
      list={{
        data: groups,
        keyExtractor: (g: Group) => g.key,
        renderItem: ({ item }: { item: Group }) => (
          <GroupView group={item} selectedId={selectedId} onPick={pickInstructor} />
        ),
        extraData: selectedId,
        initialNumToRender: 4,
        maxToRenderPerBatch: 3,
        windowSize: 7,
      }}
    >
      <ClayList>
        {data.canPickPersonal ? (
          <ClayListRow
            leading={<Avatar userId={data.myUserId} name={data.myName} size={42} />}
            title="Le mie guide"
            chevron={false}
            trailing={data.selected.kind === 'personal' ? check : null}
            onPress={() => pick({ kind: 'personal' })}
            testID="agenda-scope-personal"
          />
        ) : null}
        <ClayListRow
          leading={<EveryoneFaces people={data.instructors} />}
          title="Tutti gli istruttori"
          subtitle="Le guide affiancate per orario"
          chevron={false}
          trailing={data.selected.kind === 'all' ? check : null}
          onPress={() => pick({ kind: 'all' })}
          testID="agenda-scope-all"
        />
      </ClayList>
      {others.length >= SEARCH_MIN ? (
        <ClaySearchField
          value={query}
          onChangeText={setQuery}
          placeholder={`Cerca tra ${others.length} istruttori`}
          autoCapitalize="words"
          style={s.search}
          testID="agenda-scope-search"
        />
      ) : null}
    </FormSheet>
  );
}

/** Due volti sovrapposti: «tutti» detto senza icone né etichette. */
function EveryoneFaces({ people }: { people: AgendaScopeInstructor[] }) {
  const [a, b] = people;
  if (!a) return <View style={s.faces} />;
  if (!b) return <Avatar userId={a.userId} name={a.name} size={42} />;
  return (
    <View style={s.faces}>
      <View style={s.faceBack}>
        <Avatar userId={b.userId} name={b.name} size={30} />
      </View>
      <View style={s.faceFront}>
        <Avatar userId={a.userId} name={a.name} size={30} />
      </View>
    </View>
  );
}

function byLetter(people: AgendaScopeInstructor[]): Array<[string, AgendaScopeInstructor[]]> {
  const groups = new Map<string, AgendaScopeInstructor[]>();
  for (const p of people) {
    const letter = p.name.trim()[0]?.toLocaleUpperCase('it') ?? '#';
    const arr = groups.get(letter);
    if (arr) arr.push(p);
    else groups.set(letter, [p]);
  }
  return [...groups.entries()];
}

const GroupView = React.memo(function GroupView({
  group,
  selectedId,
  onPick,
}: {
  group: Group;
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  if (!group.people.length) {
    return (
      <View>
        {group.title ? <Text style={s.section}>{group.title}</Text> : null}
        {group.empty ? <Text style={s.none}>Nessun istruttore trovato.</Text> : null}
      </View>
    );
  }
  return (
    <View>
      {group.title ? <Text style={s.section}>{group.title}</Text> : null}
      {group.letter ? <Text style={s.letter}>{group.letter}</Text> : null}
      <ClayList>
        {group.people.map((p) => (
          <InstructorRow key={p.id} person={p} selected={p.id === selectedId} onPick={onPick} />
        ))}
      </ClayList>
    </View>
  );
});

const InstructorRow = markClayRow(
  React.memo(function InstructorRow({
    person,
    selected,
    onPick,
    divider,
    first,
    last,
  }: {
    person: AgendaScopeInstructor;
    selected: boolean;
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
        leading={<Avatar userId={person.userId} name={person.name} size={42} />}
        title={person.name}
        chevron={false}
        trailing={selected ? <Ionicons name="checkmark" size={22} color={CLAY.ink} accessibilityLabel="Selezionato" /> : null}
        onPress={() => onPick(person.id)}
        testID="agenda-scope-row"
      />
    );
  }),
);

const s = StyleSheet.create({
  blank: { backgroundColor: '#FFFFFF', height: 1 },
  search: { marginTop: 18 },
  faces: { width: 42, height: 42 },
  faceBack: { position: 'absolute', right: 0, top: 0 },
  faceFront: { position: 'absolute', left: 0, bottom: 0 },
  section: { fontSize: 17, fontWeight: '600', color: CLAY.ink, paddingHorizontal: 4, paddingTop: 22, paddingBottom: 10, letterSpacing: -0.2 },
  letter: { fontSize: 13, fontWeight: '600', color: CLAY.ink4, paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6 },
  none: { fontSize: 14.5, color: CLAY.ink3, paddingHorizontal: 4, paddingTop: 4 },
});
