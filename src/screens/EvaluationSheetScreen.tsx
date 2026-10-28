import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { usePreventRemove } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkeletonBlock } from '../components/Skeleton';
import { ClayButton, ClayList, ClaySection, ClaySurface, ClayToggle } from '../components/clay';
import { ClayPageHeader } from '../components/ClayPageHeader';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { SOFT_CARD_EXIT, SOFT_LAYOUT, SOFT_SPRING, SOFT_SWAP_IN, SOFT_SWAP_OUT, softEnter } from '../utils/motion';
import { regloApi } from '../services/regloApi';
import { useSession } from '../context/SessionContext';
import { useEvaluationSheet } from '../hooks/queries/useEvaluationSheet';
import { queryKeys } from '../hooks/queries/queryKeys';
import { evaluationItemStore } from '../stores/evaluationItemStore';
import {
  BASE_EVALUATION_TEMPLATE,
  MAX_EVALUATION_ITEMS,
  asEvaluationScale,
} from '../utils/evaluationSheet';
import { ImpactFeedbackStyle, impactAsync } from '../utils/haptics';

/** Le stelline del pagellino restano gialle (deroga voluta, CLAUDE.md). */
const GOLD = '#FACC15';

/** Altezza fissa della card voce + distanza fra una e l'altra: il riordino
 *  lavora su un passo costante, quindi il nome sta su una riga sola (per
 *  esteso lo si legge e modifica nel foglio). */
const ROW_H = 74;
const GAP = 10;
const STEP = ROW_H + GAP;

/** Riga in editing: `id` assente = voce non ancora salvata a DB. */
type Draft = {
  key: string;
  id?: string;
  label: string;
  scaleMax: number;
};

const newKey = () => `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;

/** Firma del draft: serve solo a capire se c'è qualcosa da salvare. */
const signature = (enabled: boolean, items: Draft[]) =>
  `${enabled ? '1' : '0'}|${items.map((i) => `${i.id ?? 'new'}:${i.label}:${i.scaleMax}`).join('|')}`;

const StarRow = ({ total, size = 15 }: { total: number; size?: number }) => (
  <View style={s.stars}>
    {Array.from({ length: total }, (_, i) => (
      <Ionicons key={i} name="star" size={size} color={GOLD} />
    ))}
  </View>
);

/* ── Riga trascinabile ───────────────────────────────────────────────────── */

type RowProps = {
  item: Draft;
  count: number;
  positions: { value: Record<string, number> };
  onPress: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCommit: () => void;
};

const SortableRow = ({
  item,
  count,
  positions,
  onPress,
  onDragStart,
  onDragEnd,
  onCommit,
}: RowProps) => {
  const top = useSharedValue((positions.value[item.key] ?? 0) * STEP);
  const active = useSharedValue(false);
  const startTop = useSharedValue(0);

  // Quando un'altra riga scavalca questa, la sua posizione cambia da sotto:
  // qui la si insegue con una molla invece di teletrasportarla.
  useAnimatedReaction(
    () => positions.value[item.key],
    (next, prev) => {
      if (next == null || next === prev) return;
      if (!active.value) top.value = withSpring(next * STEP, SOFT_SPRING);
    },
  );

  const tick = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
  }, []);
  const grab = useCallback(() => {
    void impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  // Il pan vive SOLO sulla maniglia e spegne lo scroll appena il dito tocca
  // (onBegin, non onStart): così la ScrollView non ruba mai il gesto.
  const pan = Gesture.Pan()
    .onBegin(() => {
      active.value = true;
      startTop.value = top.value;
      runOnJS(onDragStart)();
      runOnJS(grab)();
    })
    .onUpdate((e) => {
      top.value = startTop.value + e.translationY;
      const current = positions.value[item.key];
      const next = Math.max(0, Math.min(count - 1, Math.round(top.value / STEP)));
      if (next === current) return;
      const map = { ...positions.value };
      const swapped = Object.keys(map).find((k) => map[k] === next);
      if (swapped) map[swapped] = current;
      map[item.key] = next;
      positions.value = map;
      runOnJS(tick)();
    })
    .onFinalize(() => {
      const landed = positions.value[item.key] ?? 0;
      top.value = withSpring(landed * STEP, SOFT_SPRING);
      active.value = false;
      runOnJS(onDragEnd)();
      runOnJS(onCommit)();
    });

  // L'ombra clay è fissa (non si anima mai): la voce presa si stacca solo
  // con la scala.
  const style = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: active.value ? 20 : 1,
    transform: [{ scale: withTiming(active.value ? 1.03 : 1, { duration: 140 }) }],
  }));

  return (
    <Animated.View
      style={[s.row, CLAY_SHADOW.raiseSm, style]}
      entering={SOFT_SWAP_IN}
      exiting={SOFT_SWAP_OUT}
    >
      {/* Niente View con flex:1 qui dentro: riempiva tutta l'altezza e
          mandava a vuoto il justifyContent, così nome e stelline restavano
          incollati al bordo alto della card mentre la maniglia era centrata. */}
      <Pressable onPress={onPress} style={s.rowBody}>
        <Text style={s.rowLabel} numberOfLines={1}>
          {item.label}
        </Text>
        <StarRow total={item.scaleMax} />
      </Pressable>
      <GestureDetector gesture={pan}>
        <View style={s.handle} accessibilityLabel={`Sposta ${item.label}`}>
          <Ionicons name="reorder-two" size={22} color={CLAY.chevron} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
};

/* ── Schermata ───────────────────────────────────────────────────────────── */

/**
 * Pagellino — REG-639 clay: testata grande con l'indietro clay, interruttore
 * su una superficie clay, voci come card clay trascinabili (ombra fissa, si
 * stacca solo con la scala), CTA clay. Prima apertura: il modello base in una
 * lista clay, «Usa il modello base» / «Parti da zero». Stelline gialle.
 */
export const EvaluationSheetScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useSession();
  const { data, isLoading } = useEvaluationSheet();

  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Firma di ciò che è a DB: tutto ciò che se ne discosta è da salvare. */
  const [savedKey, setSavedKey] = useState<string | null>(null);
  /** true = autoscuola che non ha mai configurato il pagellino → modello base. */
  const [pristine, setPristine] = useState(false);

  const positions = useSharedValue<Record<string, number>>({});
  const hydrated = useRef(false);

  // Il server è la fonte: il draft si semina una volta sola, altrimenti un
  // refetch in background cancellerebbe le modifiche in corso.
  useEffect(() => {
    if (!data || hydrated.current) return;
    hydrated.current = true;
    const next = data.items.map((i) => ({
      key: i.id,
      id: i.id,
      label: i.label,
      scaleMax: asEvaluationScale(i.scaleMax),
    }));
    setEnabled(data.enabled);
    setItems(next);
    setSavedKey(signature(data.enabled, next));
    setPristine(next.length === 0);
  }, [data]);

  // La mappa delle posizioni segue la lista: si rifà a ogni aggiunta/rimozione.
  useEffect(() => {
    const map: Record<string, number> = {};
    items.forEach((it, idx) => {
      map[it.key] = idx;
    });
    positions.value = map;
  }, [items, positions]);

  const dirty = savedKey != null && signature(enabled, items) !== savedKey;

  /** Riordino finito: la lista di stato prende l'ordine delle posizioni. */
  const commitOrder = useCallback(() => {
    const map = positions.value;
    setItems((prev) => {
      const next = [...prev].sort((a, b) => (map[a.key] ?? 0) - (map[b.key] ?? 0));
      return next.some((it, i) => it.key !== prev[i]?.key) ? next : prev;
    });
  }, [positions]);

  const openItemSheet = useCallback(
    (item: Draft | null) => {
      evaluationItemStore.set({
        initial: item ? { label: item.label, scaleMax: item.scaleMax } : null,
        onSubmit: ({ label, scaleMax }) => {
          setPristine(false);
          setItems((prev) =>
            item
              ? prev.map((i) => (i.key === item.key ? { ...i, label, scaleMax } : i))
              : [...prev, { key: newKey(), label, scaleMax }],
          );
        },
        onDelete: item
          ? () => setItems((prev) => prev.filter((i) => i.key !== item.key))
          : undefined,
      });
      router.push('/(tabs)/more/evaluation-item');
    },
    [router],
  );

  const useTemplate = useCallback(() => {
    setPristine(false);
    setEnabled(true);
    setItems(
      BASE_EVALUATION_TEMPLATE.map((t) => ({
        key: newKey(),
        label: t.label,
        scaleMax: t.scaleMax,
      })),
    );
  }, []);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await regloApi.saveEvaluationSheet({
        enabled,
        items: items.map((i) => ({ id: i.id, label: i.label.trim(), scaleMax: i.scaleMax })),
      });
      const fresh = (res?.items ?? []).map((i) => ({
        key: i.id,
        id: i.id,
        label: i.label,
        scaleMax: asEvaluationScale(i.scaleMax),
      }));
      const freshEnabled = res?.enabled ?? enabled;
      setItems(fresh);
      setEnabled(freshEnabled);
      setSavedKey(signature(freshEnabled, fresh));
      setPristine(false);
      queryClient.setQueryData(queryKeys.evaluationSheet(activeCompanyId), res);
      void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
    } catch (err) {
      Alert.alert(
        'Errore',
        err instanceof Error ? err.message : 'Impossibile salvare il pagellino.',
      );
    } finally {
      setSaving(false);
    }
  }, [saving, enabled, items, queryClient, activeCompanyId]);

  // Vale anche per lo swipe-back iOS, non solo per la freccia.
  usePreventRemove(dirty && !saving, ({ data: ev }) => {
    Alert.alert('Modifiche non salvate', 'Vuoi uscire senza salvare il pagellino?', [
      { text: 'Resta', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: () => navigation.dispatch(ev.action),
      },
    ]);
  });

  const listHeight = useMemo(
    () => (items.length ? items.length * STEP - GAP : 0),
    [items.length],
  );
  const full = items.length >= MAX_EVALUATION_ITEMS;

  return (
    <View style={s.root}>
      <StatusBar style="dark" />

      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top, paddingBottom: 40 + insets.bottom + (dirty ? 96 : 0) }]}
        showsVerticalScrollIndicator={false}
      >
        <ClayPageHeader title="Pagellino" onBack={() => router.back()} />

        {isLoading && !data ? (
          <View style={s.skel}>
            <SkeletonBlock height={96} radius={28} />
            <SkeletonBlock height={ROW_H} radius={22} />
            <SkeletonBlock height={ROW_H} radius={22} />
            <SkeletonBlock height={ROW_H} radius={22} />
          </View>
        ) : (
          <>
            {/* Interruttore: è la domanda prima di tutte le altre. */}
            <ClaySurface style={s.toggleCard}>
              <View style={s.toggleText}>
                <Text style={s.toggleTitle}>Pagellino attivo</Text>
                <Text style={s.toggleSub}>
                  {enabled
                    ? 'Gli istruttori valutano le guide su queste voci.'
                    : 'Spento: nessuna valutazione nel foglio della guida. Quelle già date restano.'}
                </Text>
              </View>
              <ClayToggle
                value={enabled}
                onValueChange={(v) => {
                  void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
                  setEnabled(v);
                }}
                accessibilityLabel="Pagellino attivo"
                testID="evaluation-enabled"
              />
            </ClaySurface>

            {pristine && items.length === 0 ? (
              /* Prima apertura: il modello base pronto da adottare, invece di
                 una lista vuota da riempire a mano. */
              <Animated.View entering={SOFT_SWAP_IN}>
                <ClaySection
                  title="Modello base"
                  footnote="Le cinque voci più usate dalle autoscuole, tutte a 5 stelline. Puoi rinominarle, cambiarne la scala o toglierle quando vuoi."
                >
                  <ClayList>
                    {BASE_EVALUATION_TEMPLATE.map((t) => (
                      <TemplateRow key={t.label} label={t.label} total={t.scaleMax} />
                    ))}
                  </ClayList>
                </ClaySection>
                <View style={s.templateCtas}>
                  <ClayButton title="Usa il modello base" onPress={useTemplate} testID="evaluation-use-template" />
                  <ClayButton
                    title="Parti da zero"
                    variant="secondary"
                    onPress={() => {
                      setPristine(false);
                      openItemSheet(null);
                    }}
                    testID="evaluation-from-scratch"
                  />
                </View>
              </Animated.View>
            ) : (
              <Animated.View layout={SOFT_LAYOUT}>
                <ClaySection
                  title="Voci"
                  action={
                    items.length ? (
                      <Animated.Text key={items.length} entering={SOFT_SWAP_IN} style={s.listCount}>
                        {items.length === 1 ? '1 voce' : `${items.length} voci`}
                      </Animated.Text>
                    ) : null
                  }
                >
                  <Animated.View layout={SOFT_LAYOUT} style={{ height: listHeight }}>
                    {items.map((item) => (
                      <SortableRow
                        key={item.key}
                        item={item}
                        count={items.length}
                        positions={positions}
                        onPress={() => openItemSheet(item)}
                        onDragStart={() => setDragging(true)}
                        onDragEnd={() => setDragging(false)}
                        onCommit={commitOrder}
                      />
                    ))}
                  </Animated.View>

                  {full ? (
                    <Animated.Text entering={SOFT_SWAP_IN} style={s.note}>
                      Massimo {MAX_EVALUATION_ITEMS} voci raggiunto.
                    </Animated.Text>
                  ) : (
                    <Animated.View layout={SOFT_LAYOUT} entering={SOFT_SWAP_IN} style={s.add}>
                      <ClayButton
                        title="Aggiungi voce"
                        variant="secondary"
                        compact
                        onPress={() => openItemSheet(null)}
                        testID="evaluation-add-item"
                      />
                    </Animated.View>
                  )}

                  {items.length === 0 ? (
                    <Animated.Text layout={SOFT_LAYOUT} entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={s.note}>
                      Nessuna voce: gli istruttori non hanno niente da valutare.
                    </Animated.Text>
                  ) : null}

                  <Text style={s.footNote}>
                    Le voci tolte non si cancellano: le valutazioni già date restano
                    leggibili nello storico dell&apos;allievo.
                  </Text>
                </ClaySection>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* La CTA entra solo quando c'è davvero qualcosa da salvare. */}
      {dirty ? (
        <Animated.View
          entering={softEnter()}
          exiting={SOFT_CARD_EXIT}
          style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}
          pointerEvents="box-none"
        >
          <ClayButton title="Salva pagellino" onPress={save} loading={saving} testID="evaluation-save" />
        </Animated.View>
      ) : null}
    </View>
  );
};

/** Riga del modello base: nome + stelline, non premibile. */
function TemplateRow({ label, total, divider }: { label: string; total: number; divider?: boolean }) {
  return (
    <View style={s.templateRow}>
      {divider ? <View style={s.templateDivider} /> : null}
      <Text style={s.templateLabel} numberOfLines={1}>
        {label}
      </Text>
      <StarRow total={total} size={14} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20 },
  skel: { gap: 12, marginTop: 20 },

  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 20 },
  toggleText: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: 16.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.25 },
  toggleSub: { fontSize: 13.5, color: CLAY.ink3, marginTop: 3, lineHeight: 18 },

  listCount: { fontSize: 14, color: CLAY.ink3 },

  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: CLAY.surface,
    paddingLeft: 18,
    paddingRight: 6,
  },
  rowBody: { flex: 1, minWidth: 0, height: '100%', justifyContent: 'center', alignItems: 'flex-start' },
  // lineHeight esplicito: senza, la scatola del testo cambia col font e le due
  // righe della card non tengono la stessa distanza fra una voce e l'altra.
  rowLabel: { fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2, lineHeight: 20 },
  // marginLeft -1.5: il glifo stella ha un margine interno, senza compensarlo
  // la fila parte più a destra del nome e le due righe non sono a filo.
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6, marginLeft: -1.5 },
  handle: { width: 46, height: ROW_H, alignItems: 'center', justifyContent: 'center' },

  add: { marginTop: 16 },
  note: { fontSize: 13.5, color: CLAY.ink3, textAlign: 'center', marginTop: 14, lineHeight: 18 },
  footNote: { fontSize: 13, color: CLAY.ink3, lineHeight: 18, marginTop: 18, paddingHorizontal: 4 },

  templateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14, paddingHorizontal: 18 },
  templateDivider: { position: 'absolute', top: 0, left: 18, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  templateLabel: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '500', color: CLAY.ink },
  templateCtas: { gap: 10, marginTop: 22 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
