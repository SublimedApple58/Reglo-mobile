import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayEmpty, ClayList, ClayListRow } from '../../../src/components/clay';
import { coInstructorPickerStore } from '../../../src/stores/coInstructorPickerStore';
import { regloApi } from '../../../src/services/regloApi';
import type { AutoscuolaInstructor } from '../../../src/types/regloApi';
import { CLAY } from '../../../src/theme/clay';

/**
 * REG-585 — "Altri istruttori": chi porta la guida INSIEME al principale.
 * Form sheet unico (FORM_SHEET + FormSheet, REG-639 clay): righe di una lista
 * clay senza icone, la scelta è una spunta nera.
 *
 * Multi-selezione che salva a ogni tocco (niente CTA da tagliare su Android,
 * e nessun optimistic update: spinner sulla riga → risposta del BE → lista
 * aggiornata). Il principale non compare: è già lui che tiene la guida.
 */
export default function ManageCoInstructorsScreen() {
  const data = useSyncExternalStore(coInstructorPickerStore.subscribe, coInstructorPickerStore.get);

  const [list, setList] = useState<AutoscuolaInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>(data?.selectedIds ?? []);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Chi sta guardando: serve solo per il "(tu)". Se la chiamata fallisce,
  // semplicemente non si vede l'etichetta — niente di rotto.
  const [myInstructorId, setMyInstructorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    regloApi
      .getInstructors()
      .then((items) => { if (!cancelled) setList(items ?? []); })
      .catch(() => { if (!cancelled) { setList([]); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    regloApi
      .getInstructorSettings()
      .then((st) => { if (!cancelled) setMyInstructorId(st?.instructorId ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const active = list.filter((it) => it.status !== 'inactive');
  // Il principale si VEDE (se no non si capisce chi tiene l'esame) ma non si
  // tocca: è già lui che lo porta, non può essere anche collega di se stesso.
  const main = active.find((it) => it.id === data?.mainInstructorId) ?? null;
  const selectable = active.filter((it) => it.id !== data?.mainInstructorId);

  const toggle = async (it: AutoscuolaInstructor) => {
    if (!data || savingId) return;
    const next = selected.includes(it.id)
      ? selected.filter((id) => id !== it.id)
      : [...selected, it.id];
    const previous = selected;
    setSavingId(it.id);
    setError(null);
    // Niente optimistic update: la riga si muove solo quando il BE conferma.
    try {
      await data.onToggle(next);
      setSelected(next);
    } catch (e) {
      setSelected(previous);
      setError(e instanceof Error ? e.message : 'Non è stato possibile salvare.');
    } finally {
      setSavingId(null);
    }
  };

  const subtitle = data?.subtitle ?? 'Chi la porta insieme a te.';

  return (
    <FormSheet title="Altri istruttori" subtitle={subtitle} testID="manage-co-instructors-sheet">
      {loading && list.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator size="small" color={CLAY.ink} />
          <Text style={s.muted}>Carico gli istruttori…</Text>
        </View>
      ) : failed ? (
        <ClayEmpty title="Istruttori non disponibili" text="Non sono riuscito a caricare gli istruttori." />
      ) : selectable.length === 0 && !main ? (
        <ClayEmpty title="Nessun altro istruttore" text="Non ci sono altri istruttori da aggiungere." />
      ) : (
        <View>
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <ClayList>
            {/* Il principale, in cima e bloccato. */}
            {main ? (
              <ClayListRow
                key={main.id}
                title={`${main.name}${main.id === myInstructorId ? ' (tu)' : ''}`}
                subtitle="Principale · tiene lui questa guida"
                testID="co-instructor-main"
              />
            ) : null}
            {selectable.map((it) => {
              const isOn = selected.includes(it.id);
              const isSaving = savingId === it.id;
              const blocked = savingId !== null && !isSaving;
              return (
                <ClayListRow
                  key={it.id}
                  title={`${it.name}${it.id === myInstructorId ? ' (tu)' : ''}`}
                  subtitle={isOn ? 'Porta questa guida con te' : undefined}
                  onPress={() => void toggle(it)}
                  chevron={false}
                  dimmed={blocked}
                  testID={`co-instructor-${it.id}`}
                  trailing={
                    isSaving ? (
                      <ActivityIndicator size="small" color={CLAY.ink} />
                    ) : isOn ? (
                      <Ionicons name="checkmark" size={22} color={CLAY.ink} accessibilityLabel="Selezionato" />
                    ) : null
                  }
                />
              );
            })}
          </ClayList>
          <Text style={s.footnote}>
            La guida comparirà in agenda anche a chi aggiungi, e le ore contano per tutti.
          </Text>
        </View>
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  muted: { color: CLAY.ink3, fontSize: 15, textAlign: 'center' },
  errorText: { fontSize: 14, lineHeight: 19, color: '#C13515', marginBottom: 12, paddingHorizontal: 4 },
  footnote: { marginTop: 12, fontSize: 13, lineHeight: 18, color: CLAY.ink3, paddingHorizontal: 4 },
});
