import React, { useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { evaluationItemStore } from '../stores/evaluationItemStore';
import { GradientCTABackground, primaryCtaShadow } from './GradientCTA';
import {
  EVALUATION_SCALES,
  MAX_EVALUATION_LABEL_LENGTH,
  asEvaluationScale,
  type EvaluationScale,
} from '../utils/evaluationSheet';
import { colors, navy } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { ImpactFeedbackStyle, impactAsync } from '../utils/haptics';

const NAVY = '#1A1A2E';
const MUTED = '#929292';
/** Le stelline del pagellino sono gialle su web e app: deroga voluta al
 *  mono-navy (vedi docs/features/evaluation-sheet.md). */
const GOLD = '#FACC15';

/** Fila di stelline non interattiva: dice quanto è lunga la scala. */
const ScalePreview = ({ total, size = 17 }: { total: number; size?: number }) => (
  <View style={s.stars}>
    {Array.from({ length: total }, (_, i) => (
      <Ionicons key={i} name="star" size={size} color={GOLD} />
    ))}
  </View>
);

/**
 * Foglio "voce del pagellino": nome + scala, più l'eliminazione sulle voci già
 * in elenco. Non salva nulla da solo — restituisce i valori alla schermata, che
 * tiene il draft e ha il suo "Salva pagellino".
 */
export function EvaluationItemSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(evaluationItemStore.subscribe, evaluationItemStore.get);

  const [label, setLabel] = useState(data?.initial?.label ?? '');
  const [scaleMax, setScaleMax] = useState<EvaluationScale>(
    asEvaluationScale(data?.initial?.scaleMax),
  );

  if (!data) return <View style={s.root} />;

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
    <View style={s.root}>
      <View style={s.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{isNew ? 'Nuova voce' : 'Modifica voce'}</Text>
          <Text style={s.hint}>
            Gli istruttori la aggiungono al pagellino delle guide che la toccano.
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>

      <Text style={s.fieldLabel}>Nome della voce</Text>
      <TextInput
        value={label}
        onChangeText={setLabel}
        autoFocus={isNew}
        maxLength={MAX_EVALUATION_LABEL_LENGTH}
        placeholder="Es. Manovre e parcheggio"
        placeholderTextColor="#B8B8C2"
        returnKeyType="done"
        onSubmitEditing={submit}
        style={s.input}
      />
      {remaining <= 12 ? (
        <Animated.Text entering={FadeIn.duration(160)} style={s.counter}>
          {remaining} caratteri rimasti
        </Animated.Text>
      ) : null}

      <Text style={[s.fieldLabel, { marginTop: 20 }]}>Scala</Text>
      <View style={s.scaleRow}>
        {EVALUATION_SCALES.map((scale) => {
          const on = scale === scaleMax;
          return (
            <Pressable
              key={scale}
              onPress={() => {
                void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
                setScaleMax(scale);
              }}
              style={({ pressed }) => [s.scaleCard, on && s.scaleCardOn, pressed && { opacity: 0.8 }]}
            >
              <ScalePreview total={scale} size={scale === 3 ? 19 : 16} />
              <Text style={[s.scaleText, on && s.scaleTextOn]}>{scale} stelline</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={submit}
        disabled={!canSave}
        style={({ pressed }) => [
          s.cta,
          !canSave && s.ctaOff,
          pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
        ]}
      >
        {canSave ? <GradientCTABackground radius={27} /> : null}
        <Text style={[s.ctaText, !canSave && s.ctaTextOff]}>
          {isNew ? 'Aggiungi voce' : 'Salva voce'}
        </Text>
      </Pressable>

      {data.onDelete ? (
        <Pressable
          onPress={confirmDelete}
          style={({ pressed }) => [s.delete, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.deleteText}>Elimina voce</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // Form sheet hug: niente insets.bottom (è la safe area della FINESTRA, non
  // dello sheet) — vedi docs/design-system.md §13.2.1.
  root: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: 26,
    paddingBottom: 18,
  },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 24, gap: 12 },
  title: { fontSize: 21, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  hint: { fontSize: 13.5, fontWeight: '500', color: MUTED, marginTop: 5, lineHeight: 18 },
  x: {
    width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4',
    alignItems: 'center', justifyContent: 'center',
  },

  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: MUTED, marginBottom: 9, letterSpacing: 0.1 },
  input: {
    minHeight: 56, borderRadius: 18, backgroundColor: '#F7F7F8',
    borderWidth: 1.5, borderColor: 'transparent',
    paddingHorizontal: 16, fontSize: 16, fontWeight: '600', color: NAVY,
  },
  counter: { fontSize: 12, fontWeight: '500', color: MUTED, marginTop: 8, marginLeft: 4 },

  scaleRow: { flexDirection: 'row', gap: 10 },
  scaleCard: {
    flex: 1, minHeight: 82, borderRadius: 18, backgroundColor: '#F7F7F8',
    borderWidth: 1.5, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  scaleCardOn: { backgroundColor: navy[50], borderColor: NAVY },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scaleText: { fontSize: 13.5, fontWeight: '600', color: MUTED },
  scaleTextOn: { color: NAVY },

  cta: {
    marginTop: 24, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    ...primaryCtaShadow,
  },
  ctaOff: { backgroundColor: '#ECECEF', shadowOpacity: 0, elevation: 0 },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  ctaTextOff: { color: '#A3A3AD' },

  delete: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  deleteText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
