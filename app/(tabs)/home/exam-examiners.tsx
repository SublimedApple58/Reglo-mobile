import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import {
  ClayButton,
  ClayList,
  ClayListRow,
  ClaySection,
  clayRowPadding,
  CLAY_ROW_PRESSED,
  markClayRow,
  type ClayRowPosition,
} from '../../../src/components/clay';
import { useDoneAccessory } from '../../../src/components/KeyboardDoneAccessory';
import { cleanExaminers, EXAMINERS_MAX, examinersSheetStore } from '../../../src/stores/examinersSheetStore';
import { regloApi } from '../../../src/services/regloApi';
import { CLAY } from '../../../src/theme/clay';

/** Solo dissolvenze, niente layout transition (design-system §15). */
const ENTER = FadeIn.duration(200);
const EXIT = FadeOut.duration(150);
const MAX_SUGGESTIONS = 6;

type Row = { key: number; name: string };

/**
 * REG-640 — gli esaminatori dell'esame: persone ESTERNE (la motorizzazione),
 * quindi nomi liberi e non istruttori. Di solito uno: il foglio parte con una
 * riga e «Aggiungi esaminatore» compare quando quella è compilata.
 *
 * Sotto, «Già usati»: i nomi che l'autoscuola ha già scritto, filtrati su
 * quello che si sta scrivendo. Un tocco riempie la riga in corso (o ne
 * aggiunge una). Form sheet unico, CTA a capsula in fondo; il salvataggio
 * aspetta la risposta del BE (niente optimistic update).
 */
export default function ExamExaminersScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(examinersSheetStore.subscribe, examinersSheetStore.get);
  const { accessoryID, accessory } = useDoneAccessory();

  const nextKey = useRef(0);
  const makeRow = (name: string): Row => ({ key: nextKey.current++, name });
  const [rows, setRows] = useState<Row[]>(() => {
    const start = data?.examiners.length ? data.examiners : [''];
    return start.map((n) => makeRow(n));
  });
  const [focusedKey, setFocusedKey] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const inputs = useRef(new Map<number, TextInput | null>());
  const focusOnMount = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    regloApi
      .getExamExaminerSuggestions()
      .then((names) => { if (!cancelled) setSuggestions(names ?? []); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => { examinersSheetStore.clear(); }, []);

  useEffect(() => {
    if (focusOnMount.current === null) return;
    inputs.current.get(focusOnMount.current)?.focus();
    focusOnMount.current = null;
  }, [rows]);

  const focused = rows.find((r) => r.key === focusedKey) ?? null;
  const shownSuggestions = useMemo(() => {
    const typed = (focused?.name ?? '').trim().toLocaleLowerCase('it');
    const taken = new Set(rows.map((r) => r.name.trim().toLocaleLowerCase('it')));
    return suggestions
      .filter((s) => {
        const key = s.toLocaleLowerCase('it');
        if (taken.has(key)) return false;
        return !typed || key.includes(typed);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [suggestions, rows, focused]);

  if (!data) return <View style={s.empty} />;

  const last = rows[rows.length - 1];
  const canAdd = rows.length < EXAMINERS_MAX && last.name.trim() !== '';

  const setName = (key: number, name: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, name } : r)));

  const removeRow = (key: number) =>
    setRows((prev) => (prev.length === 1 ? [makeRow('')] : prev.filter((r) => r.key !== key)));

  const addRow = (name = '', focus = true) => {
    const row = makeRow(name);
    if (focus) focusOnMount.current = row.key;
    setRows((prev) => [...prev, row]);
  };

  const pickSuggestion = (name: string) => {
    // La riga in corso (o l'ultima se vuota) prende il nome; se no se ne aggiunge una.
    const target = focused ?? (last.name.trim() === '' ? last : null);
    if (target) {
      setName(target.key, name);
      inputs.current.get(target.key)?.blur();
      return;
    }
    if (rows.length < EXAMINERS_MAX) addRow(name, false);
  };

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await data.onConfirm(cleanExaminers(rows.map((r) => r.name)));
      router.back();
    } catch (err) {
      Alert.alert('Errore', err instanceof Error ? err.message : 'Impossibile salvare gli esaminatori.');
      setSaving(false);
    }
  };

  return (
    <FormSheet
      title="Esaminatori"
      subtitle="Chi esamina gli allievi. Di solito uno."
      onClose={() => { if (!saving) router.back(); }}
      busy={saving}
      testID="exam-examiners-sheet"
      cta={<ClayButton title={data.ctaTitle} loading={saving} onPress={confirm} testID="exam-examiners-confirm" />}
    >
      <ClayList>
        {rows.map((row, idx) => (
          <ExaminerInputRow
            key={row.key}
            inputRef={(el) => { inputs.current.set(row.key, el); }}
            value={row.name}
            placeholder={idx === 0 ? 'Nome e cognome' : 'Altro esaminatore'}
            editable={!saving}
            removable={row.name !== '' || rows.length > 1}
            accessoryID={accessoryID}
            onChangeText={(t) => setName(row.key, t)}
            onFocus={() => setFocusedKey(row.key)}
            onBlur={() => setFocusedKey((k) => (k === row.key ? null : k))}
            onSubmit={() => { if (canAdd && row.key === last.key) addRow(); }}
            onRemove={() => removeRow(row.key)}
            testID={`exam-examiner-${idx}`}
          />
        ))}
        {canAdd && !saving ? (
          <ClayListRow
            title="Aggiungi esaminatore"
            leading={<Ionicons name="add" size={22} color={CLAY.ink} />}
            chevron={false}
            onPress={() => addRow()}
            testID="exam-examiners-add"
          />
        ) : null}
      </ClayList>

      {shownSuggestions.length > 0 && !saving ? (
        <Animated.View entering={ENTER} exiting={EXIT}>
          <ClaySection title="Già usati" style={s.section}>
            <ClayList>
              {shownSuggestions.map((name) => (
                <ClayListRow
                  key={name}
                  title={name}
                  chevron={false}
                  trailing={<Ionicons name="add-circle-outline" size={22} color={CLAY.ink3} />}
                  onPress={() => pickSuggestion(name)}
                />
              ))}
            </ClayList>
          </ClaySection>
        </Animated.View>
      ) : null}
      {accessory}
    </FormSheet>
  );
}

/** Riga della lista clay con il campo di testo dentro e la X per toglierla. */
const ExaminerInputRow = markClayRow(function ExaminerInputRow({
  inputRef,
  value,
  placeholder,
  editable,
  removable,
  accessoryID,
  onChangeText,
  onFocus,
  onBlur,
  onSubmit,
  onRemove,
  testID,
  divider,
  first,
  last,
}: ClayRowPosition & {
  inputRef: (el: TextInput | null) => void;
  value: string;
  placeholder: string;
  editable: boolean;
  removable: boolean;
  accessoryID?: string;
  onChangeText: (t: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
  onRemove: () => void;
  testID?: string;
}) {
  return (
    <Animated.View
      entering={ENTER}
      exiting={EXIT}
     
      style={[s.row, clayRowPadding({ first, last }, 4)]}
    >
      {divider ? <View style={s.divider} /> : null}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={CLAY.ink4}
        editable={editable}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        maxLength={80}
        inputAccessoryViewID={accessoryID}
        style={s.input}
        testID={testID}
      />
      {removable && editable ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={value ? `Togli ${value}` : 'Togli riga'}
          style={({ pressed }) => [s.remove, pressed && CLAY_ROW_PRESSED]}
        >
          <Ionicons name="close" size={18} color={CLAY.ink3} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
});

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  section: { marginTop: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 10 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: 0.5, backgroundColor: 'rgba(17,17,17,0.12)' },
  input: { flex: 1, minHeight: 52, fontSize: 16.5, color: CLAY.ink, letterSpacing: -0.25, paddingVertical: 14 },
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
