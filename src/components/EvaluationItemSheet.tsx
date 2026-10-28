import React, { useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { evaluationItemStore } from '../stores/evaluationItemStore';
import {
  EVALUATION_SCALES,
  MAX_EVALUATION_LABEL_LENGTH,
  asEvaluationScale,
  type EvaluationScale,
} from '../utils/evaluationSheet';
import { FormSheet } from './SheetScaffold';
import { ClayButton, ClayField, ClaySegmented } from './clay';
import { CLAY_DANGER } from './ClayAccountParts';
import { CLAY } from '../theme/clay';

/** Le stelline del pagellino sono gialle su web e app: deroga voluta al
 *  bianco/nero (vedi docs/features/evaluation-sheet.md). */
const GOLD = '#FACC15';

/**
 * Foglio "voce del pagellino" — REG-639 clay: il form sheet unico (FORM_SHEET
 * + FormSheet). Nome (campo clay) + scala (segmentato clay, con l'anteprima
 * delle stelline), più l'eliminazione sulle voci già in elenco come testo
 * rosso sotto la CTA. Non salva nulla da solo — restituisce i valori alla
 * schermata, che tiene il draft e ha il suo "Salva pagellino".
 */
export function EvaluationItemSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(evaluationItemStore.subscribe, evaluationItemStore.get);

  const [label, setLabel] = useState(data?.initial?.label ?? '');
  const [scaleMax, setScaleMax] = useState<EvaluationScale>(asEvaluationScale(data?.initial?.scaleMax));

  if (!data) return <View style={s.empty} />;

  const isNew = !data.initial;
  const trimmed = label.trim();
  const canSave = trimmed.length > 0;
  const remaining = MAX_EVALUATION_LABEL_LENGTH - label.length;

  const submit = () => {
    if (!canSave) return;
    data.onSubmit({ label: trimmed, scaleMax });
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Eliminare la voce?',
      `"${data.initial?.label ?? 'La voce'}" non comparirà più nei pagellini nuovi. Le valutazioni già date restano leggibili nello storico.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            data.onDelete?.();
            router.back();
          },
        },
      ],
    );
  };

  return (
    <FormSheet
      title={isNew ? 'Nuova voce' : 'Modifica voce'}
      subtitle="Gli istruttori la aggiungono al pagellino delle guide che la toccano."
      testID="evaluation-item-sheet"
      cta={
        <View style={s.ctas}>
          <ClayButton
            title={isNew ? 'Aggiungi voce' : 'Salva voce'}
            onPress={submit}
            disabled={!canSave}
            testID="evaluation-item-save"
          />
          {data.onDelete ? (
            <Pressable
              onPress={confirmDelete}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Elimina voce"
              testID="evaluation-item-delete"
              style={({ pressed }) => [s.delete, pressed && { opacity: 0.5 }]}
            >
              <Text style={s.deleteTx}>Elimina voce</Text>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <ClayField
        label="Nome della voce"
        value={label}
        onChangeText={setLabel}
        autoFocus={isNew}
        maxLength={MAX_EVALUATION_LABEL_LENGTH}
        placeholder="Es. Manovre e parcheggio"
        returnKeyType="done"
        onSubmitEditing={submit}
        hint={remaining <= 12 ? `${remaining} caratteri rimasti` : undefined}
        testID="evaluation-item-label"
      />

      <Text style={s.label}>Scala</Text>
      <ClaySegmented
        options={EVALUATION_SCALES.map((scale) => ({ value: scale, label: `${scale} stelline` }))}
        value={scaleMax}
        onChange={setScaleMax}
        testID="evaluation-item-scale"
      />
      <View style={s.stars} accessibilityLabel={`${scaleMax} stelline`}>
        {Array.from({ length: scaleMax }, (_, i) => (
          <Ionicons key={i} name="star" size={20} color={GOLD} />
        ))}
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  label: { fontSize: 15, fontWeight: '500', color: CLAY.ink, marginTop: 22, marginBottom: 8, paddingHorizontal: 2 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 3, marginTop: 14 },
  ctas: { gap: 4 },
  delete: { height: 44, alignItems: 'center', justifyContent: 'center' },
  deleteTx: { fontSize: 16, fontWeight: '500', color: CLAY_DANGER },
});
