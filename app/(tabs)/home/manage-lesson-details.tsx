import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useDoneAccessory } from '../../../src/components/KeyboardDoneAccessory';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lessonDetailsStore } from '../../../src/stores/lessonDetailsStore';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { SelectableChip } from '../../../src/components/SelectableChip';
import { StarRating } from '../../../src/components/StarRating';
import { LESSON_TYPE_OPTIONS, resolveInitialLessonTypes } from '../../../src/utils/lessonTypes';
import {
  EVALUATION_NOT_APPLICABLE_LABEL,
  defaultEvaluationScore,
  starSizeForScale,
} from '../../../src/utils/evaluationSheet';
import { regloApi } from '../../../src/services/regloApi';
import type { EvaluationItem } from '../../../src/types/regloApi';
import { isMotoLicenseCategory } from '../../../src/utils/license';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { SheetScaffold } from '../../../src/components/SheetScaffold';

function outcomeFromStatus(status?: string | null): 'checked_in' | 'no_show' | null {
  const s = (status ?? '').toLowerCase();
  if (s === 'checked_in' || s === 'completed') return 'checked_in';
  if (s === 'no_show') return 'no_show';
  return null;
}

export default function ManageLessonDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(lessonDetailsStore.subscribe, lessonDetailsStore.get);

  const lesson = data?.lesson ?? null;
  // Spinner/lock del salvataggio gestito in locale: questo foglio ha uno store
  // dedicato, non vede più il pendingAction live del flusso home.
  const [saving, setSaving] = useState(false);

  const [types, setTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  // Pagellino (REG-443): voci dell'autoscuola + punteggio per voce. Caricato
  // all'apertura del foglio in una sola chiamata; resta vuoto (sezione
  // nascosta) per le autoscuole che non lo usano.
  const [evalItems, setEvalItems] = useState<EvaluationItem[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  /**
   * Voci dichiarate "non valutabili" su QUESTA guida (il trattino accanto alle
   * stelline). Stato separato dai punteggi: togliendo l'esclusione torna il
   * voto di prima invece del default.
   */
  const [notApplicable, setNotApplicable] = useState<Record<string, boolean>>({});
  /** true = questa guida ha già punteggi salvati: il pagellino resta visibile
   *  (in sola lettura se non è più modificabile) per la consultazione. */
  const [hasSavedScores, setHasSavedScores] = useState(false);
  // Esito (Presente/Assente) — mostrato solo quando data.showEsito (storico
  // allievo): segnare effettuata sblocca la valutazione. Nel flusso home resta
  // nascosto (l'esito è nel foglio padre).
  const [esito, setEsito] = useState<'checked_in' | 'no_show' | null>(null);
  // While the notes field is focused we collapse the sections above it so the
  // sheet shrinks enough to float fully above the keyboard on iOS (a tall
  // fitToContents form sheet can't lift far enough otherwise → notes stay
  // covered). They fade back on blur (incl. via the "Fatto" toolbar button).
  const [notesFocused, setNotesFocused] = useState(false);
  const { accessoryID, accessory } = useDoneAccessory();

  // Smooth height/opacity collapse of the sections above the notes. Kept mounted
  // and animated to height 0 (measured once while expanded) so the fitToContents
  // sheet compacts fluidly instead of snapping.
  const collapse = useSharedValue(0); // 0 = expanded, 1 = collapsed
  const collapsibleH = useSharedValue(0);
  useEffect(() => {
    collapse.value = withTiming(notesFocused ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesFocused]);
  const collapsibleStyle = useAnimatedStyle(() => {
    const h = collapsibleH.value;
    const p = collapse.value;
    return {
      opacity: 1 - p,
      height: h > 0 ? h * (1 - p) : undefined,
      transform: [{ translateY: -8 * p }],
    };
  });

  // Clear on dismiss: il prossimo opener ri-seeda comunque prima del push.
  useEffect(() => {
    return () => {
      lessonDetailsStore.clear();
    };
  }, []);

  useEffect(() => {
    const id = lesson?.id;
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const data = await regloApi.getAppointmentEvaluation(id);
        if (!alive || !data?.enabled) return;
        const items = data.items ?? [];
        const rows = data.scores ?? [];
        const saved = new Map(
          rows.filter((sc) => sc.score != null).map((sc) => [sc.itemId, sc.score as number]),
        );
        setEvalItems(items);
        setHasSavedScores(rows.length > 0);
        // Niente precompilazione: restano solo i voti davvero salvati.
        setScores(
          Object.fromEntries(
            items.filter((it) => saved.has(it.id)).map((it) => [it.id, saved.get(it.id)!]),
          ),
        );
        setNotApplicable(
          Object.fromEntries(rows.filter((sc) => sc.notApplicable).map((sc) => [sc.itemId, true])),
        );
      } catch {
        // Il pagellino non deve impedire di salvare tipo/voto/note: se la
        // chiamata fallisce la sezione semplicemente non compare.
      }
    })();
    return () => {
      alive = false;
    };
  }, [lesson?.id]);

  useEffect(() => {
    if (!lesson) return;
    setTypes(resolveInitialLessonTypes(lesson));
    setNotes(lesson.notes ?? '');
    setEsito(outcomeFromStatus(lesson.status));
  }, [lesson]);

  if (!data || !lesson) {
    return <View style={s.root} />;
  }

  const { isDetailsEditable, onSaveDetails } = data;
  const editable = isDetailsEditable && !saving;
  const showEsito = data.showEsito === true;
  // Il tipo cambierebbe il `type` dell'appuntamento: nascosto su esami/gruppi
  // (ne romperebbe la categoria). Nel flusso home questo foglio si apre solo per
  // guide individuali, quindi il gate è un no-op lì.
  const lessonTypeLc = (lesson.type ?? '').toLowerCase();
  // Le guide moto usano "Tipo guida moto" (birilli/strada) → il "Tipo guida"
  // generico (attività) è ridondante e va nascosto.
  const isMotoLesson =
    isMotoLicenseCategory(lesson.vehicle?.licenseCategory) ||
    isMotoLicenseCategory(lesson.student?.licenseCategory);
  // Voci effettivamente valutate: il contatore in testa alla sezione.
  const scoredCount = evalItems.filter(
    (item) => scores[item.id] != null && !notApplicable[item.id],
  ).length;
  const showTypes =
    lessonTypeLc !== 'group_lesson' && lessonTypeLc !== 'esame' && !lesson.groupLessonId && !isMotoLesson;

  /**
   * Azioni in blocco sul pagellino: con molte voci, riempirle o azzerarle a
   * mano sarebbe il lavoro più noioso della giornata. Menu NATIVO (action sheet
   * su iOS, Alert su Android), come il menu "•••" dei veicoli.
   */
  const openEvalActions = () => {
    if (!editable) return;
    const fillAll = () =>
      setScores((prev) => {
        const next = { ...prev };
        for (const item of evalItems) {
          if (next[item.id] == null && !notApplicable[item.id]) {
            next[item.id] = defaultEvaluationScore(item.scaleMax);
          }
        }
        return next;
      });
    const naRest = () =>
      setNotApplicable((prev) => {
        const next = { ...prev };
        for (const item of evalItems) {
          if (scores[item.id] == null) next[item.id] = true;
        }
        return next;
      });
    const clearAll = () => {
      setScores({});
      setNotApplicable({});
    };
    const options = ['Valuta tutte a metà scala', 'Segna non valutabili le restanti', 'Azzera il pagellino'];
    const run = [fillAll, naRest, clearAll];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Pagellino · questa guida',
          options: [...options, 'Annulla'],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: 2,
        },
        (i) => { if (i < options.length) run[i](); },
      );
    } else {
      Alert.alert('Pagellino · questa guida', undefined, [
        { text: options[0], onPress: fillAll },
        { text: options[1], onPress: naRest },
        { text: options[2], style: 'destructive', onPress: clearAll },
        { text: 'Annulla', style: 'cancel' },
      ]);
    }
  };

  const handleSave = async () => {
    if (!editable) return;
    setSaving(true);
    try {
      const ok = await onSaveDetails({
        lessonTypes: types,
        notes,
        esito,
        // Si mandano SOLO le voci toccate: una voce lasciata in bianco non è un
        // giudizio, e il server cancella le righe omesse.
        evaluations: evalItems.length
          ? evalItems
              .filter((item) => notApplicable[item.id] || scores[item.id] != null)
              .map((item) =>
                notApplicable[item.id]
                  ? { itemId: item.id, score: null, notApplicable: true }
                  : { itemId: item.id, score: scores[item.id]! },
              )
          : undefined,
      });
      if (ok) router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    // PAGE_SHEET: la schermata ha l'altezza dello schermo, il root la riempie
    // e il corpo dentro SheetScaffold `fill` ha spazio definito da scrollare.
    <View style={[s.root, { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <SheetScaffold
        // fill: corpo scrollabile + "Salva" agganciato in fondo su ENTRAMBE le
        // piattaforme (stesso pattern di quick-book e booking-rules).
        fill
        keyboardAware
        // Coda del contenuto: senza, l'ultima voce del pagellino finisce
        // incollata al bordo del "Salva" e sembra tagliata.
        contentContainerStyle={[s.scaffoldBody, { paddingBottom: 28, flexGrow: 1 }]}
        footer={
          <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <Pressable
              onPress={handleSave}
              disabled={!editable}
              style={({ pressed }) => [s.saveBtn, s.saveFooter, pressed && { opacity: 0.9 }, !editable && { opacity: 0.4 }]}
            >
              <GradientCTABackground radius={27} />
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.saveText}>Salva</Text>
              )}
            </Pressable>
          </View>
        }
      >
      <View style={s.headerBlock}>
        <Text style={s.title}>Dettagli guida</Text>
        <Text style={s.subtitle}>Tipo, pagellino e note di questa guida.</Text>
      </View>

      {/* Tipo guida — collapse while typing notes so the sheet
          shrinks and the textarea floats above the keyboard. */}
      <Animated.View
        style={[s.collapsible, collapsibleStyle]}
        pointerEvents={notesFocused ? 'none' : 'auto'}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && collapse.value === 0) collapsibleH.value = h;
        }}
      >
          {/* Tipo guida */}
          {showTypes ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Tipo guida</Text>
              <View style={s.chipList}>
                {LESSON_TYPE_OPTIONS.map((option) => (
                  <SelectableChip
                    key={option.value}
                    label={option.label}
                    active={types.includes(option.value)}
                    onPress={() => {
                      if (!editable) return;
                      setTypes((prev) => {
                        if (prev.includes(option.value)) {
                          const next = prev.filter((t) => t !== option.value);
                          return next.length ? next : [option.value];
                        }
                        return [...prev, option.value];
                      });
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Esito (solo storico) */}
          {showEsito ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Esito</Text>
              <View style={s.esitoRow}>
                <Pressable
                  onPress={() => editable && setEsito((e) => (e === 'checked_in' ? null : 'checked_in'))}
                  style={[s.esitoBtn, esito === 'checked_in' && s.esitoBtnActive]}
                >
                  <Text style={[s.esitoText, esito === 'checked_in' && s.esitoTextPresente]}>Presente</Text>
                </Pressable>
                <Pressable
                  onPress={() => editable && setEsito((e) => (e === 'no_show' ? null : 'no_show'))}
                  style={[s.esitoBtn, esito === 'no_show' && s.esitoBtnActive]}
                >
                  <Text style={[s.esitoText, esito === 'no_show' && s.esitoTextAssente]}>Assente</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* La valutazione a stellina singola non si compila più: al suo posto
              c'è il pagellino qui sotto. I voti già dati restano leggibili nello
              storico guide, sulle guide che non hanno il pagellino. */}
      </Animated.View>

      {/* Pagellino dell'autoscuola: una riga per voce, stelline quante la scala */}
      {/* Il pagellino NON segue il gate della valutazione complessiva: si compila
          anche a metà guida o prima del check-in (i punteggi non hanno vincoli di
          stato lato server). Resta fuori solo dalle guide annullate senza voti,
          dove un pagellino vuoto e non toccabile sarebbe solo rumore. */}
      {evalItems.length > 0 && (isDetailsEditable || hasSavedScores) ? (
        <View style={[s.section, { marginBottom: 20 }]}>
          <View style={s.pagellinoHead}>
            <Text style={s.sectionLabel}>Pagellino</Text>
            <View style={s.pagellinoHeadRight}>
              {/* Il contatore fa da spiegazione: dice da solo che non è tutto
                  da compilare. Nessuna riga di testo in più sotto la card. */}
              <Text style={s.pagellinoHint}>
                {`${scoredCount} di ${evalItems.length}`}
              </Text>
              {editable ? (
                <Pressable
                  onPress={openEvalActions}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Azioni sul pagellino"
                  style={({ pressed }) => [s.pagellinoPill, pressed && { opacity: 0.7 }]}
                >
                  <Text style={s.pagellinoPillText}>Tutte</Text>
                  <Ionicons name="chevron-down" size={13} color="#6A6A6A" />
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={s.pagellinoCard}>
            {evalItems.map((item, index) => {
              // Nessuna precompilazione: 0 = voce non ancora valutata.
              const value = scores[item.id] ?? 0;
              const isNa = notApplicable[item.id] === true;
              return (
                <View key={item.id} style={[s.pagellinoItem, index > 0 && s.pagellinoItemBorder]}>
                  <View style={s.pagellinoItemTop}>
                    <Text
                      style={[s.pagellinoLabel, isNa && s.pagellinoLabelOff]}
                      numberOfLines={2}
                    >
                      {item.label}
                      {item.archived ? ' (non più in uso)' : ''}
                    </Text>
                    <Text style={s.pagellinoValue}>
                      {isNa
                        ? EVALUATION_NOT_APPLICABLE_LABEL
                        : value
                          ? `${value}/${item.scaleMax}`
                          : ''}
                    </Text>
                  </View>
                  <View style={s.scaleRow}>
                    {/* Trattino = "non valutabile su questa guida": fa parte
                        della scala, così la riga delle stelline resta una cosa
                        sola da toccare. In sola lettura sparisce e resta il
                        testo "non valutabile" sopra. */}
                    {editable ? (
                      <>
                        <Pressable
                          onPress={() =>
                            setNotApplicable((prev) => {
                              const next = { ...prev };
                              if (next[item.id]) delete next[item.id];
                              else next[item.id] = true;
                              return next;
                            })
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isNa }}
                          accessibilityLabel={`${item.label}: non valutabile in questa guida`}
                          style={({ pressed }) => [
                            s.naDash,
                            isNa && s.naDashOn,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={[s.naDashText, isNa && s.naDashTextOn]}>—</Text>
                        </Pressable>
                        <View style={s.scaleSep} />
                      </>
                    ) : null}
                    <StarRating
                      value={isNa ? 0 : value}
                      total={item.scaleMax}
                      tone="gold"
                      size={starSizeForScale(item.scaleMax)}
                      onChange={
                        editable && !isNa
                          ? (next) =>
                              setScores((prev) => {
                                const copy = { ...prev };
                                // Ritoccare la stellina già scelta riporta la
                                // voce a "non valutata" (StarRating manda 0).
                                if (!next) delete copy[item.id];
                                else copy[item.id] = next;
                                return copy;
                              })
                          : undefined
                      }
                      readOnly={!editable || isNa}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Note */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Note</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onFocus={() => setNotesFocused(true)}
          onBlur={() => setNotesFocused(false)}
          placeholder="Aggiungi note operative o osservazioni."
          placeholderTextColor={colors.textMuted}
          multiline
          style={s.notes}
          editable={editable}
          inputAccessoryViewID={accessoryID}
        />
      </View>
      </SheetScaffold>

      {accessory}
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 0, gap: 20 },
  scaffoldBody: { gap: 20 },
  saveFooter: { marginTop: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  collapsible: { gap: 20, paddingBottom: 20, overflow: 'hidden' },
  section: { gap: 12 },
  esitoRow: { flexDirection: 'row', gap: 6, backgroundColor: '#F2F2F4', borderRadius: 12, padding: 4 },
  esitoBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 9 },
  esitoBtnActive: { backgroundColor: '#FFFFFF' },
  esitoText: { fontSize: 14, fontWeight: '600', color: '#8A8A8F' },
  esitoTextPresente: { color: '#047857' },
  esitoTextAssente: { color: '#B91C1C' },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  pagellinoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pagellinoHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  pagellinoHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pagellinoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, height: 28, paddingHorizontal: 11,
    borderRadius: 999, borderWidth: 1.5, borderColor: '#E2E2E8',
  },
  pagellinoPillText: { fontSize: 12.5, fontWeight: '600', color: '#6A6A6A' },
  pagellinoCard: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', borderRadius: 16,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14,
  },
  pagellinoItem: { paddingVertical: 12, gap: 6 },
  pagellinoItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1F1F3' },
  pagellinoItemTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  pagellinoLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  pagellinoLabelOff: { color: '#A3A3AD' },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  naDash: {
    width: 38, height: 34, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E2E8',
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  naDashOn: { borderColor: '#1A1A2E', backgroundColor: '#F7F7F8' },
  naDashText: { fontSize: 15, fontWeight: '700', color: '#A3A3AD', lineHeight: 18 },
  naDashTextOn: { color: '#1A1A2E' },
  scaleSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: '#ECECEC' },
  pagellinoValue: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notes: {
    minHeight: 110, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, color: '#1A1A2E', backgroundColor: '#F7F7F8',
    textAlignVertical: 'top', fontSize: 15, lineHeight: 22,
  },

  saveBtn: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    ...primaryCtaShadow,
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
