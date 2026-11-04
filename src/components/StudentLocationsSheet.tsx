import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { studentLocationsStore } from '../stores/studentLocationsStore';
import { FormSheet } from './SheetScaffold';
import { ClayButton, ClayList, ClayListRow } from './clay';
import { CLAY, CLAY_SHADOW } from '../theme/clay';

/**
 * Form sheet «Luoghi» dell'allievo (REG-705, anteprima approvata da Tiziano
 * il 03/11). Scelta multipla dei luoghi dove fa guida; il principale (REG-392)
 * si sceglie tra i luoghi spuntati con «Rendi principale». Nessun luogo = vede
 * tutti i luoghi. «Salva» compare solo con modifiche e aggiorna la scheda sulla
 * risposta del backend.
 */
export function StudentLocationsSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(studentLocationsStore.subscribe, studentLocationsStore.get);

  const [picked, setPicked] = useState<string[]>(data?.selectedIds ?? []);
  const [primary, setPrimary] = useState<string | null>(data?.primaryId ?? null);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => {
    if (!data) return false;
    const a = [...picked].sort().join(',');
    const b = [...data.selectedIds].sort().join(',');
    return a !== b || (picked.length > 0 && primary !== data.primaryId);
  }, [data, picked, primary]);

  if (!data) return <View style={s.root} />;

  const toggle = (id: string) => {
    if (saving) return;
    Haptics.selectionAsync().catch(() => {});
    const next = picked.includes(id) ? picked.filter((v) => v !== id) : [...picked, id];
    setPicked(next);
    // Il principale resta tra i luoghi scelti: se lo togli passa al primo.
    if (next.length && !(primary && next.includes(primary))) {
      setPrimary(data.locations.find((l) => next.includes(l.id))?.id ?? null);
    }
  };

  const makePrimary = (id: string) => {
    if (saving) return;
    Haptics.selectionAsync().catch(() => {});
    setPrimary(id);
  };

  const save = async () => {
    setSaving(true);
    try {
      await data.onSave({ locationIds: picked, primaryId: picked.length ? primary : null });
      router.back();
    } catch {
      // L'errore lo mostra chi salva; il foglio resta aperto con le scelte.
    } finally {
      setSaving(false);
    }
  };

  const firstName = data.studentName?.trim().split(/\s+/)[0] ?? null;

  return (
    <FormSheet
      title="Luoghi"
      subtitle={`${firstName ?? 'L’allievo'} vede solo le disponibilità dei luoghi scelti.`}
      testID="student-locations-sheet"
      busy={saving}
      dirty={dirty}
      cta={
        dirty ? (
          <ClayButton title="Salva" onPress={save} loading={saving} testID="student-locations-save" />
        ) : undefined
      }
    >
      <ClayList>
        {data.locations.map((l) => {
          const on = picked.includes(l.id);
          const isPrimary = on && primary === l.id;
          const subtitle = isPrimary ? (
            <Text style={s.subMain}>Principale</Text>
          ) : on ? (
            <Pressable onPress={() => makePrimary(l.id)} hitSlop={8} testID={`student-location-primary-${l.id}`}>
              <Text style={s.subLink}>Rendi principale</Text>
            </Pressable>
          ) : (
            <Text style={s.sub} numberOfLines={1}>
              {l.isPrecise && l.address ? l.address : 'Posizione generica'}
            </Text>
          );
          return (
            <ClayListRow
              key={l.id}
              title={l.name}
              subtitle={subtitle}
              chevron={false}
              onPress={() => toggle(l.id)}
              testID={`student-location-${l.id}`}
              trailing={
                <View style={[s.check, on ? [s.checkOn, CLAY_SHADOW.raiseSm] : CLAY_SHADOW.sink]}>
                  {on ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                </View>
              }
            />
          );
        })}
      </ClayList>
      <Text style={s.foot}>
        {picked.length
          ? 'Il principale precompila il luogo delle guide.'
          : 'Nessun luogo scelto: vede tutti i luoghi.'}
      </Text>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: '#FFFFFF', height: 1 },
  sub: { fontSize: 13, color: CLAY.ink4 },
  subMain: { fontSize: 13, fontWeight: '500', color: CLAY.ink2 },
  subLink: {
    fontSize: 13,
    color: CLAY.ink3,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(17,17,17,0.25)',
  },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#1E1E1E' },
  foot: { fontSize: 13, lineHeight: 18, color: CLAY.ink4, textAlign: 'center', marginTop: 14, marginHorizontal: 8 },
});
