import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { optionsPickerStore, shouldShowPickerSearch } from '../stores/optionsPickerStore';
import { matchesPersonSearch } from '../utils/peopleSearch';
import { FormSheet } from './SheetScaffold';
import { Avatar, ClayButton, ClayList, ClaySearchField } from './clay';
import { SettingCheckRow } from './SettingsRows';
import { CLAY } from '../theme/clay';

const SUCCESS = '#2F7A4A';
const ACCENT = '#C2410C';

/**
 * Corpo condiviso del picker di opzioni. Sempre un form sheet alto quanto il
 * contenuto (REG-639, Tiziano 28/10): `scrollable` (route `select-options-long`)
 * decide solo se compare la ricerca oltre `PICKER_SEARCH_THRESHOLD` voci
 * (REG-617); la lista lunga scorre col foglio stesso.
 */
export function OptionsPickerSheet({ scrollable }: { scrollable: boolean }) {
  const router = useRouter();
  const data = useSyncExternalStore(optionsPickerStore.subscribe, optionsPickerStore.get);

  const [picked, setPicked] = useState<string[]>(data?.selected ?? []);
  const [query, setQuery] = useState('');

  const options = data?.options ?? [];
  const showSearch = shouldShowPickerSearch(options.length, scrollable);
  // Si cerca su etichetta E sottotitolo: nel picker degli allievi il
  // sottotitolo porta la patente, e cercare "B" per vedere i B e' legittimo.
  const visible = useMemo(
    () =>
      showSearch
        ? options.filter((o) => matchesPersonSearch(`${o.label} ${o.subtitle ?? ''}`, query))
        : options,
    [options, query, showSearch],
  );

  if (!data) return <View style={s.root} />;

  const pickSingle = (value: string) => {
    data.onConfirm([value]);
    router.back();
  };
  const toggleMulti = (value: string) =>
    setPicked((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  const confirmMulti = () => {
    data.onConfirm(picked);
    router.back();
  };

  // Righe da Impostazioni iOS in una lista clay: la scelta è la spunta nera a
  // destra (Tiziano 28/10: niente pallini né bordo nero sulla riga). Tutta la
  // riga è premibile.
  const rows = visible.map((o) => {
    const on = data.multi ? picked.includes(o.value) : data.selected.includes(o.value);
    return (
      <SettingCheckRow
        key={o.value}
        title={o.label}
        subtitle={o.subtitle}
        subtitleColor={o.subtitleTone ? (o.subtitleTone === 'success' ? SUCCESS : ACCENT) : null}
        oneLine
        leading={o.leadingInitials ? <Avatar userId={o.leadingUserId ?? null} name={o.label} size={38} /> : undefined}
        trailing={
          o.trailingInitials && !on ? (
            <View style={s.trailingAvatar}><Text style={s.trailingAvatarText}>{o.trailingInitials}</Text></View>
          ) : undefined
        }
        checked={on}
        onPress={() => (data.multi ? toggleMulti(o.value) : pickSingle(o.value))}
        testID={`option-${o.value}`}
      />
    );
  });

  // REG-639 (Tiziano 28/10): TUTTI i fogli sono form sheet alti quanto il
  // contenuto (FORM_SHEET + FormSheet), anche le liste lunghe: superata
  // l'altezza dello schermo scorre il foglio stesso. Clay: niente blu, la
  // selezione è nera, la CTA è la capsula nera con il conteggio nel testo.
  return (
    <FormSheet
      title={data.title}
      subtitle={data.hint || undefined}
      testID="options-picker"
      cta={
        data.multi ? (
          <ClayButton
            title={picked.length ? `${data.confirmLabel ?? 'Conferma'} · ${picked.length}` : (data.confirmLabel ?? 'Conferma')}
            onPress={confirmMulti}
            disabled={!picked.length}
            testID="options-picker-confirm"
          />
        ) : undefined
      }
    >
      {showSearch ? (
        <ClaySearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Cerca per nome"
          returnKeyType="search"
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={s.search}
        />
      ) : null}
      {visible.length === 0 ? (
        <Animated.Text entering={FadeIn.duration(140)} style={s.empty}>
          {data.emptyLabel ?? 'Nessun risultato'}
        </Animated.Text>
      ) : (
        <ClayList>{rows}</ClayList>
      )}
      {data.footnote ? <Text style={s.footnote}>{data.footnote}</Text> : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: '#FFFFFF', height: 1 },
  search: { marginBottom: 14 },
  empty: { fontSize: 14.5, color: CLAY.ink3, textAlign: 'center', paddingVertical: 34 },
  trailingAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  trailingAvatarText: { fontSize: 10.5, fontWeight: '600', color: CLAY.ink },
  footnote: { fontSize: 13, color: CLAY.ink3, lineHeight: 18, marginTop: 16, marginHorizontal: 4 },
});
