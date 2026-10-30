import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { CLAY } from '../../../src/theme';
import { ClayList, ClaySearchField } from '../../../src/components/clay';
import { matchesPersonSearch } from '../../../src/utils/peopleSearch';
import { roadFreePreselect } from '../../../src/road/freeStartStore';
import { formatHm } from '../../../src/road/format';
import { prefetchPlan } from '../../../src/road/planStore';
import { detailOf, PersonRow, useAvvioData, type Person } from '../../../src/road/avvioParts';
import {
  AVVIO_ALLIEVO_ROUTE,
  AVVIO_PARTI_ROUTE,
  avvioStore,
  hasRoadHistory,
  roadStudentData,
  warmRoadStudents,
} from '../../../src/road/avvioFlow';

/**
 * REG-662 (piano 005) — avvio guida, foglio 1 di 3: «Con chi guidi?».
 * Ricerca in cima, «Suggeriti» (i tre di oggi col motivo del server), poi
 * tutti gli allievi in ordine alfabetico (FlatList del foglio, gruppi per
 * lettera). Il tocco spinge sopra il foglio 2 «<Nome> su Road», o il 3 se
 * l'allievo non ha ancora niente su Road. Trascinando giù si torna qui.
 */
export default function AvviaGuidaSheet() {
  const router = useRouter();
  const data = useAvvioData();
  const { options, students, minutes, byId, blocked } = data;
  const [query, setQuery] = useState('');
  // La home non preseleziona più nessuno: si svuota per i vecchi percorsi.
  useState(() => roadFreePreselect.take());

  const suggested: Person[] = useMemo(() => {
    const sugg = options?.suggestions?.slice(0, 3) ?? [];
    if (sugg.length) {
      return sugg.map((x) => ({ id: x.id, name: x.name, detail: blocked.has(x.id) ? 'Prenotazioni bloccate' : x.reason, sortKey: '' }));
    }
    return (options?.recentStudents ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      detail: detailOf(byId.get(r.id), minutes[r.id], blocked.has(r.id)),
      sortKey: '',
    }));
  }, [options, byId, minutes, blocked]);

  // Road dei suggeriti pronta prima del tocco (decide se c'è il foglio 2) e i loro giri.
  const suggestedKey = suggested.map((p) => p.id).join(',');
  useEffect(() => {
    const ids = suggestedKey ? suggestedKey.split(',') : [];
    const stop = warmRoadStudents(ids);
    for (const id of ids) prefetchPlan(id, options?.defaultDuration ?? 60);
    return stop;
  }, [suggestedKey, options?.defaultDuration]);

  const everyone: Person[] = useMemo(
    () =>
      (students ?? [])
        .filter((st) => st.status !== 'inactive' && st.studentPhase !== 'PATENTATO')
        .map((st) => {
          const name = `${st.firstName} ${st.lastName}`.trim();
          return { id: st.id, name, detail: detailOf(st, minutes[st.id], blocked.has(st.id)), sortKey: name.toLocaleLowerCase('it') };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'it')),
    [students, minutes, blocked],
  );

  const pick = useCallback(
    (id: string) => {
      Haptics.selectionAsync().catch(() => undefined);
      avvioStore.set({ studentId: id, lesson: null });
      // Senza niente su Road (già saputo) si salta il foglio 2.
      const known = roadStudentData(id);
      router.push((known !== undefined && !hasRoadHistory(known) ? AVVIO_PARTI_ROUTE : AVVIO_ALLIEVO_ROUTE) as never);
    },
    [router],
  );

  const q = query.trim();
  const nowLabel = `Da adesso, ${formatHm(new Date().toISOString())}`;

  if (!options) {
    return (
      <FormSheet title="Con chi guidi?" subtitle={nowLabel}>
        <ActivityIndicator color="#111111" style={{ marginVertical: 30 }} />
      </FormSheet>
    );
  }

  const shownAll = q ? everyone.filter((p) => matchesPersonSearch(p.name, q)) : everyone;
  const groups: PickGroup[] = [];
  if (!q && suggested.length) groups.push({ key: 'sugg', title: options.suggestions?.length ? 'Suggeriti' : 'Le tue ultime guide', people: suggested });
  groups.push({
    key: 'all',
    head: q ? `Risultati · ${shownAll.length}` : `Tutti gli allievi${students ? ` · ${shownAll.length}` : ''}`,
    status: !students ? 'loading' : !shownAll.length ? 'empty' : undefined,
    people: [],
  });
  if (students && shownAll.length) {
    if (q) groups.push({ key: 'results', people: shownAll });
    else for (const [letter, people] of byLetter(shownAll)) groups.push({ key: `l-${letter}`, letter, people });
  }

  return (
    <FormSheet
      title="Con chi guidi?"
      subtitle={nowLabel}
      testID="road-free-pick"
      list={{
        data: groups,
        keyExtractor: (g: PickGroup) => g.key,
        renderItem: ({ item }: { item: PickGroup }) => <PickGroupView group={item} onPick={pick} />,
        initialNumToRender: 4,
        maxToRenderPerBatch: 3,
        windowSize: 7,
      }}
    >
      <ClaySearchField value={query} onChangeText={setQuery} placeholder="Cerca allievo" autoCapitalize="words" testID="road-free-search" />
    </FormSheet>
  );
}

/** Raggruppa per iniziale (liste «Tutti gli allievi» alla iOS). */
function byLetter(people: Person[]): Array<[string, Person[]]> {
  const groups = new Map<string, Person[]>();
  for (const p of people) {
    const letter = p.sortKey[0]?.toUpperCase() ?? '#';
    groups.set(letter, [...(groups.get(letter) ?? []), p]);
  }
  return [...groups.entries()];
}

type PickGroup = {
  key: string;
  title?: string;
  head?: string;
  status?: 'loading' | 'empty';
  letter?: string;
  people: Person[];
};

/** Un gruppo della lista: titolo o lettera e la sua superficie clay. */
const PickGroupView = React.memo(function PickGroupView({ group, onPick }: { group: PickGroup; onPick: (id: string) => void }) {
  if (group.head !== undefined) {
    return (
      <View>
        <Text style={s.section}>{group.head}</Text>
        {group.status === 'loading' ? (
          <ActivityIndicator color={CLAY.ink3} style={{ marginTop: 18 }} />
        ) : group.status === 'empty' ? (
          <Text style={s.empty}>Nessun allievo trovato.</Text>
        ) : null}
      </View>
    );
  }
  return (
    <View>
      {group.title ? <Text style={s.section}>{group.title}</Text> : null}
      {group.letter ? <Text style={s.letter}>{group.letter}</Text> : null}
      <ClayList>
        {group.people.map((p, i) => (
          <PersonRow key={p.id} index={i} person={p} onPick={onPick} />
        ))}
      </ClayList>
    </View>
  );
});

const s = StyleSheet.create({
  // Intestazioni di sezione native in frase normale (niente maiuscoletto da eyebrow).
  section: { fontSize: 15, fontWeight: '600', color: CLAY.ink, paddingHorizontal: 4, paddingTop: 22, paddingBottom: 10, letterSpacing: -0.2 },
  letter: { fontSize: 13, fontWeight: '600', color: CLAY.ink4, paddingHorizontal: 4, paddingTop: 16, paddingBottom: 6 },
  empty: { fontSize: 14.5, color: CLAY.ink3, paddingHorizontal: 4, paddingTop: 14 },
});
