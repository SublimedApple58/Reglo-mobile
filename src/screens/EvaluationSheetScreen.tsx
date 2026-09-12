import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { usePreventRemove } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '../components/Screen';
import { SkeletonBlock } from '../components/Skeleton';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { GradientCTABackground, primaryCtaShadow } from '../components/GradientCTA';
import { colors, navy, spacing } from '../theme';
import { regloApi } from '../services/regloApi';
import { useSession } from '../context/SessionContext';
import { useEvaluationSheet } from '../hooks/queries/useEvaluationSheet';
import { queryKeys } from '../hooks/queries/queryKeys';
import { evaluationItemStore } from '../stores/evaluationItemStore';
import {
  BASE_EVALUATION_TEMPLATE,
  DEFAULT_EVALUATION_SCALE,
  MAX_EVALUATION_ITEMS,
  asEvaluationScale,
} from '../utils/evaluationSheet';
import { ImpactFeedbackStyle, impactAsync } from '../utils/haptics';

const FLUENT_MEMO = require('../../assets/icons/fluent-memo.png');

const NAVY = '#1A1A2E';
const MUTED = '#929292';
const GOLD = '#FACC15';

/** Altezza fissa della card voce + distanza fra una e l'altra: il riordino
 *  lavora su un passo costante, quindi il nome sta su una riga sola (per
 *  esteso lo si legge e modifica nel foglio). */
const ROW_H = 74;
const GAP = 10;
const STEP = ROW_H + GAP;

const SPRING = { damping: 20, stiffness: 260, mass: 0.6 } as const;
const LAYOUT = LinearTransition.springify().damping(22).stiffness(240).mass(0.6);

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
      if (!active.value) top.value = withSpring(next * STEP, SPRING);
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
      top.value = withSpring(landed * STEP, SPRING);
      active.value = false;
      runOnJS(onDragEnd)();
      runOnJS(onCommit)();
    });

  const style = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: active.value ? 20 : 1,
    transform: [{ scale: withTiming(active.value ? 1.03 : 1, { duration: 140 }) }],
    shadowOpacity: withTiming(active.value ? 0.14 : 0.04, { duration: 140 }),
    shadowRadius: withTiming(active.value ? 16 : 5, { duration: 140 }),
  }));

  return (
    <Animated.View
      style={[s.row, style]}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
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
          <Ionicons name="reorder-two" size={22} color="#C4C4CE" />
        </View>
      </GestureDetector>
    </Animated.View>
  );
};

/* ── Schermata ───────────────────────────────────────────────────────────── */

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
    <Screen>
      <StatusBar style="dark" />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={[s.headerTitle, { flex: 1 }]}>Pagellino</Text>
      </View>

      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={[s.scroll, { paddingBottom: 40 + insets.bottom + (dirty ? 90 : 0) }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && !data ? (
          <View style={{ gap: 12 }}>
            <SkeletonBlock height={104} radius={22} />
            <SkeletonBlock height={74} radius={20} />
            <SkeletonBlock height={74} radius={20} />
            <SkeletonBlock height={74} radius={20} />
          </View>
        ) : (
          <>
            {/* Interruttore: è la domanda prima di tutte le altre. */}
            <View style={s.toggleCard}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.toggleTitle}>Pagellino attivo</Text>
                <Text style={s.toggleSub}>
                  {enabled
                    ? 'Gli istruttori valutano le guide su queste voci.'
                    : 'Spento: nessuna valutazione nel foglio della guida. Quelle già date restano.'}
                </Text>
              </View>
              <ToggleSwitch
                value={enabled}
                onValueChange={(v) => {
                  void impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
                  setEnabled(v);
                }}
              />
            </View>

            {pristine && items.length === 0 ? (
              /* Prima apertura: il modello base pronto da adottare, invece di
                 una lista vuota da riempire a mano. */
              <Animated.View entering={FadeIn.duration(260)} style={s.empty}>
                <Image source={FLUENT_MEMO} style={s.emptyIcon} />
                <Text style={s.emptyTitle}>Modello base</Text>
                <Text style={s.emptySub}>
                  Le cinque voci più usate dalle autoscuole, tutte a 5 stelline. Puoi
                  rinominarle, cambiarne la scala o toglierle quando vuoi.
                </Text>
                <View style={s.emptyList}>
                  {BASE_EVALUATION_TEMPLATE.map((t, i) => (
                    <View key={t.label} style={[s.emptyRow, i > 0 && s.emptyRowBorder]}>
                      <Text style={s.emptyRowText} numberOfLines={1}>
                        {t.label}
                      </Text>
                      <StarRow total={t.scaleMax} size={14} />
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={useTemplate}
                  style={({ pressed }) => [s.emptyCta, pressed && { opacity: 0.9 }]}
                >
                  <GradientCTABackground radius={26} />
                  <Text style={s.emptyCtaText}>Usa il modello base</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPristine(false);
                    openItemSheet(null);
                  }}
                  style={({ pressed }) => [s.emptyGhost, pressed && { opacity: 0.6 }]}
                >
                  <Text style={s.emptyGhostText}>Parti da zero</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View layout={LAYOUT} style={{ marginTop: 26 }}>
                <View style={s.listHead}>
                  <Text style={s.listLabel}>VOCI</Text>
                  {items.length ? (
                    <Animated.Text
                      key={items.length}
                      entering={FadeIn.duration(180)}
                      style={s.listCount}
                    >
                      {items.length === 1 ? '1 voce' : `${items.length} voci`}
                    </Animated.Text>
                  ) : null}
                </View>

                <Animated.View layout={LAYOUT} style={{ height: listHeight }}>
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
                  <Animated.Text entering={FadeIn.duration(200)} style={s.limit}>
                    Massimo {MAX_EVALUATION_ITEMS} voci: oltre, il pagellino non si compila
                    più in pochi secondi.
                  </Animated.Text>
                ) : (
                  <Animated.View layout={LAYOUT} entering={FadeIn.duration(200)}>
                    <Pressable
                      onPress={() => openItemSheet(null)}
                      style={({ pressed }) => [s.add, pressed && { opacity: 0.6 }]}
                    >
                      <Ionicons name="add" size={17} color="#6A6A6A" />
                      <Text style={s.addText}>Aggiungi voce</Text>
                    </Pressable>
                  </Animated.View>
                )}

                {items.length === 0 ? (
                  <Animated.Text
                    layout={LAYOUT}
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(120)}
                    style={s.none}
                  >
                    Nessuna voce: gli istruttori non hanno niente da valutare.
                  </Animated.Text>
                ) : null}

                <Text style={s.footNote}>
                  Le voci tolte non si cancellano: le valutazioni già date restano
                  leggibili nello storico dell&apos;allievo.
                </Text>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* La CTA entra solo quando c'è davvero qualcosa da salvare. */}
      {dirty ? (
        <Animated.View
          entering={FadeInDown.duration(240)}
          exiting={FadeOut.duration(160)}
          style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}
        >
          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
          >
            <GradientCTABackground radius={27} />
            <Text style={s.ctaText}>{saving ? 'Salvataggio…' : 'Salva pagellino'}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </Screen>
  );
};

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 6 },

  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  toggleTitle: { fontSize: 16, fontWeight: '600', color: NAVY, letterSpacing: -0.2 },
  toggleSub: { fontSize: 12.5, fontWeight: '500', color: MUTED, marginTop: 4, lineHeight: 17 },

  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  listLabel: { fontSize: 11.5, fontWeight: '700', color: '#A3A3AD', letterSpacing: 0.8 },
  listCount: { fontSize: 12.5, fontWeight: '600', color: MUTED },

  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EFEFF2',
    paddingLeft: 16,
    paddingRight: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowBody: { flex: 1, minWidth: 0, height: '100%', justifyContent: 'center', alignItems: 'flex-start' },
  // lineHeight esplicito: senza, la scatola del testo cambia col font e le due
  // righe della card non tengono la stessa distanza fra una voce e l'altra.
  rowLabel: { fontSize: 15.5, fontWeight: '600', color: NAVY, letterSpacing: -0.2, lineHeight: 20 },
  // marginLeft -1.5: il glifo stella ha un margine interno, senza compensarlo
  // la fila parte più a destra del nome e le due righe non sono a filo.
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6, marginLeft: -1.5 },
  handle: { width: 46, height: ROW_H, alignItems: 'center', justifyContent: 'center' },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#F7F7F8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E9EBF2',
    marginTop: 10,
  },
  addText: { fontSize: 14.5, fontWeight: '600', color: '#6A6A6A' },
  limit: { fontSize: 12.5, fontWeight: '500', color: MUTED, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  none: { fontSize: 12.5, fontWeight: '500', color: '#A3A3AD', textAlign: 'center', marginTop: 14 },
  footNote: { fontSize: 12, fontWeight: '500', color: '#A3A3AD', lineHeight: 17, marginTop: 18 },

  empty: { alignItems: 'center', marginTop: 30 },
  emptyIcon: { width: 62, height: 62, marginBottom: 14 },
  emptyTitle: { fontSize: 19, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  emptySub: {
    fontSize: 13.5, fontWeight: '500', color: MUTED, textAlign: 'center',
    lineHeight: 19, marginTop: 7, paddingHorizontal: 6,
  },
  emptyList: {
    alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 16, marginTop: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#EFEFF2',
  },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 13 },
  emptyRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F2F2F5' },
  emptyRowText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '600', color: NAVY },
  emptyCta: {
    alignSelf: 'stretch', height: 52, borderRadius: 26, marginTop: 22,
    alignItems: 'center', justifyContent: 'center', ...primaryCtaShadow,
  },
  emptyCtaText: { fontSize: 15.5, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  emptyGhost: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  emptyGhostText: { fontSize: 14.5, fontWeight: '600', color: MUTED },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: navy[100],
  },
  cta: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', ...primaryCtaShadow },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
