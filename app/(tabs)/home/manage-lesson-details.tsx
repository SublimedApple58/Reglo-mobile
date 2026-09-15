import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useDoneAccessory } from '../../../src/components/KeyboardDoneAccessory';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lessonDetailsStore } from '../../../src/stores/lessonDetailsStore';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { SelectableChip } from '../../../src/components/SelectableChip';
import { StarRating } from '../../../src/components/StarRating';
import { LESSON_TYPE_OPTIONS, resolveInitialLessonTypes } from '../../../src/utils/lessonTypes';
import {
  EVALUATION_NOT_APPLICABLE_LABEL,
  starSizeForScale,
} from '../../../src/utils/evaluationSheet';
import { optionsPickerStore, LONG_PICKER_THRESHOLD } from '../../../src/stores/optionsPickerStore';
import { regloApi } from '../../../src/services/regloApi';
import type { EvaluationItem } from '../../../src/types/regloApi';
import { isMotoLicenseCategory } from '../../../src/utils/license';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { GlassCloseButton } from '../../../src/components/GlassCloseButton';

/**
 * Transizione di posizione condivisa da tutto il blocco pagellino: quando una
 * voce entra o esce, le altre card (e il bottone sotto) scivolano al loro posto
 * di molla invece di saltarci.
 */
const LAYOUT = LinearTransition.springify().damping(22).stiffness(240).mass(0.6);

/** Firma stabile di un pagellino, per confrontare "prima" e "dopo". */
const evalKeyOf = (
  rows: ReadonlyArray<{ itemId: string; score: number | null; notApplicable?: boolean }>,
): string =>
  rows
    .map((r) => `${r.itemId}:${r.notApplicable ? 'na' : r.score ?? ''}`)
    .sort()
    .join('|');

function outcomeFromStatus(status?: string | null): 'checked_in' | 'no_show' | null {
  const s = (status ?? '').toLowerCase();
  if (s === 'checked_in' || s === 'completed') return 'checked_in';
  if (s === 'no_show') return 'no_show';
  return null;
}

export default function ManageLessonDetailsScreen() {
  const router = useRouter();
  // `as string[]`: dentro una route tipizzata il tuple non ha l'indice 1.
  const segments = useSegments() as string[];
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
   * Voci MESSE nel pagellino di questa guida. Il pagellino non è l'elenco
   * completo in attesa di stelline: l'istruttore aggiunge le voci che ha
   * davvero valutato, e quelle sono il pagellino della guida.
   */
  const [evalAdded, setEvalAdded] = useState<string[]>([]);
  /**
   * Voci salvate come "non valutabile" prima che quel concetto venisse tolto
   * dalla compilazione. Non se ne creano di nuove: restano leggibili e si
   * possono solo togliere, così salvando non si cancellano di nascosto.
   */
  const [legacyNa, setLegacyNa] = useState<Record<string, boolean>>({});
  /** Firma del pagellino come è stato caricato: serve a capire se è cambiato,
   *  compreso il caso "svuotato del tutto" (array vuoto, non `undefined`). */
  const [savedEvalKey, setSavedEvalKey] = useState('');
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
        if (!alive || !data) return;
        const rows = data.scores ?? [];
        // Pagellino SPENTO: non si aggiungono voci nuove (l'elenco si riduce a
        // quelle che questa guida ha già votato, quindi "Aggiungi voce" sparisce
        // da solo), ma i voti già dati restano leggibili e rimovibili. Stesso
        // patto del dialog web: spegnere vuol dire "non se ne danno di nuovi",
        // non "sparisce quello che c'è".
        const scoredIds = new Set(rows.map((sc) => sc.itemId));
        const items = (data.items ?? []).filter((it) => data.enabled || scoredIds.has(it.id));
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
        setLegacyNa(
          Object.fromEntries(rows.filter((sc) => sc.notApplicable).map((sc) => [sc.itemId, true])),
        );
        // Nel pagellino ci sono le voci che questa guida ha già salvato.
        setEvalAdded(rows.map((sc) => sc.itemId));
        setSavedEvalKey(
          evalKeyOf(
            rows.map((sc) => ({
              itemId: sc.itemId,
              score: sc.score ?? null,
              notApplicable: sc.notApplicable === true,
            })),
          ),
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
  /** Righe in elenco, nell'ordine del pagellino della scuola (non di aggiunta). */
  const evalRows = evalItems.filter((item) => evalAdded.includes(item.id));
  const evalAvailable = evalItems.filter((item) => !evalAdded.includes(item.id));
  const showTypes =
    lessonTypeLc !== 'group_lesson' && lessonTypeLc !== 'esame' && !lesson.groupLessonId && !isMotoLesson;

  /**
   * "Aggiungi voce": apre il form sheet NATIVO riusabile (OptionsPickerSheet),
   * lo stesso di Durata/Veicolo/Luogo, con le sole voci non ancora in elenco.
   * Selezione multipla: sul telefono aprire lo sheet una volta per voce
   * sarebbe un'animazione ogni volta.
   */
  const openAddItems = () => {
    if (!editable || !evalAvailable.length) return;
    optionsPickerStore.set({
      title: 'Aggiungi voci',
      hint: 'Scegli cosa valutare in questa guida.',
      multi: true,
      selected: [],
      confirmLabel: 'Aggiungi al pagellino',
      options: evalAvailable.map((item) => ({
        value: item.id,
        label: item.label,
        subtitle: `scala a ${item.scaleMax} stelline`,
      })),
      onConfirm: (vals) => {
        if (vals.length) setEvalAdded((prev) => [...prev, ...vals]);
      },
    });
    // La route del picker è registrata in entrambi gli stack che aprono questo
    // foglio (home + notes): va spinta su quello da cui siamo arrivati.
    const stack = segments[1] === 'notes' ? 'notes' : 'home';
    const long = evalAvailable.length > LONG_PICKER_THRESHOLD;
    router.push(`/(tabs)/${stack}/select-options${long ? '-long' : ''}`);
  };

  const handleSave = async () => {
    if (!editable) return;
    const nextRows = evalRows
      .filter((item) => legacyNa[item.id] || scores[item.id] != null)
      .map((item) =>
        legacyNa[item.id]
          ? { itemId: item.id, score: null, notApplicable: true }
          : { itemId: item.id, score: scores[item.id]!, notApplicable: false },
      );
    const evalChangedPayload =
      evalKeyOf(nextRows) === savedEvalKey
        ? undefined
        : nextRows.map(({ itemId, score, notApplicable }) =>
            notApplicable ? { itemId, score: null, notApplicable: true } : { itemId, score },
          );
    setSaving(true);
    try {
      const ok = await onSaveDetails({
        lessonTypes: types,
        notes,
        esito,
        // Solo le voci in elenco e con un voto (più le vecchie "non
        // valutabili"). `undefined` quando il pagellino non è cambiato: così
        // l'array VUOTO resta un segnale valido, ed è come si svuota davvero.
        evaluations: evalChangedPayload,
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
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
            <Ionicons name="close" size={20} color="#1A1A2E" />
          </Pressable>
        </GlassCloseButton>
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

      {/* Pagellino dell'autoscuola: NON l'elenco completo in attesa di stelline.
          L'istruttore aggiunge le voci che questa guida ha toccato, e quelle
          sono il pagellino della guida. Nessun vincolo di stato: si compila
          anche a metà guida o prima del check-in. Resta fuori solo dalle guide
          annullate senza voti, dove sarebbe solo rumore. */}
      {evalItems.length > 0 && (isDetailsEditable || hasSavedScores) ? (
        <Animated.View
          layout={LAYOUT}
          entering={FadeIn.duration(260)}
          style={[s.section, { marginBottom: 20 }]}
        >
          <View style={s.pagellinoHead}>
            <Text style={s.sectionLabel}>Pagellino</Text>
            {evalRows.length > 0 ? (
              <Animated.Text
                key={evalRows.length}
                entering={FadeIn.duration(180)}
                style={s.pagellinoHint}
              >
                {evalRows.length === 1 ? '1 voce' : `${evalRows.length} voci`}
              </Animated.Text>
            ) : null}
          </View>

          {evalRows.length > 0 ? (
            <View>
              {evalRows.map((item) => {
                const value = scores[item.id] ?? 0;
                const isNa = legacyNa[item.id] === true;
                return (
                  // entering/exiting + layout: aggiungere o togliere una voce
                  // non deve far saltare la lista — le altre card scorrono al
                  // loro posto invece di teletrasportarsi.
                  <Animated.View
                    key={item.id}
                    layout={LAYOUT}
                    entering={FadeInDown.duration(240).easing(Easing.out(Easing.cubic))}
                    exiting={FadeOut.duration(160)}
                    style={s.voiceCard}
                  >
                    <View style={s.pagellinoItemTop}>
                      <Text
                        style={[s.pagellinoLabel, isNa && s.pagellinoLabelOff]}
                        numberOfLines={2}
                      >
                        {item.label}
                        {item.archived ? ' (non più in uso)' : ''}
                      </Text>
                      {/* Il punteggio è il DATO della riga, non una didascalia:
                          pillola oro (scala gialla del tema) accanto al nome. */}
                      {isNa ? null : (
                        <Animated.View
                          layout={LAYOUT}
                          style={[s.scorePill, !scores[item.id] && s.scorePillEmpty]}
                        >
                          {scores[item.id] ? (
                            // UN SOLO Text con figlio annidato: due Text affiancati
                            // in un row si allineano per box, non per baseline, e
                            // "2" e "/5" finivano sfalsati. Annidati condividono
                            // la stessa riga di testo per costruzione.
                            <Animated.Text
                              key={scores[item.id]}
                              entering={FadeIn.duration(150)}
                              style={s.scoreNum}
                            >
                              {scores[item.id]}
                              <Text style={s.scoreMax}>/{item.scaleMax}</Text>
                            </Animated.Text>
                          ) : (
                            <Animated.Text entering={FadeIn.duration(150)} style={s.scoreEmptyText}>
                              da valutare
                            </Animated.Text>
                          )}
                        </Animated.View>
                      )}
                      {/* La × sta in alto, lontana dalle stelline: togliere una
                          voce non deve essere un errore di mira. */}
                      {editable ? (
                        <Pressable
                          onPress={() => {
                            setEvalAdded((prev) => prev.filter((id) => id !== item.id));
                            setScores((prev) => {
                              const next = { ...prev };
                              delete next[item.id];
                              return next;
                            });
                            setLegacyNa((prev) => {
                              const next = { ...prev };
                              delete next[item.id];
                              return next;
                            });
                          }}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={`Togli ${item.label} dal pagellino`}
                          style={({ pressed }) => [s.pagellinoRemove, pressed && { opacity: 0.5 }]}
                        >
                          <Ionicons name="close" size={16} color="#C4C4C4" />
                        </Pressable>
                      ) : null}
                    </View>
                    {isNa ? (
                      <Text style={s.pagellinoValue}>{EVALUATION_NOT_APPLICABLE_LABEL}</Text>
                    ) : (
                      <View style={s.pagellinoScaleRow}>
                        <StarRating
                          value={value}
                          total={item.scaleMax}
                          tone="gold"
                          size={starSizeForScale(item.scaleMax)}
                          onChange={
                            editable
                              ? (next) =>
                                  setScores((prev) => {
                                    const copy = { ...prev };
                                    // Ritoccare la stellina già scelta svuota il
                                    // voto; per togliere la voce c'è la ×.
                                    if (!next) delete copy[item.id];
                                    else copy[item.id] = next;
                                    return copy;
                                  })
                              : undefined
                          }
                          readOnly={!editable}
                        />
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          ) : null}

          {editable && evalAvailable.length > 0 ? (
            <Animated.View layout={LAYOUT} exiting={FadeOut.duration(140)}>
              <Pressable
                onPress={openAddItems}
                accessibilityRole="button"
                style={({ pressed }) => [s.pagellinoAdd, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="add" size={17} color="#6A6A6A" />
                <Text style={s.pagellinoAddText}>Aggiungi voce da valutare</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {evalRows.length === 0 ? (
            <Animated.Text
              layout={LAYOUT}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(120)}
              style={s.pagellinoEmpty}
            >
              Nessuna voce: questa guida non ha ancora un pagellino.
            </Animated.Text>
          ) : null}
        </Animated.View>
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
  pagellinoCard: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', borderRadius: 16,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14,
  },
  pagellinoItem: { paddingVertical: 12, gap: 6 },
  pagellinoItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1F1F3' },
  pagellinoItemTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  pagellinoLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  pagellinoLabelOff: { color: '#A3A3AD' },
  voiceCard: {
    borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EFEFF2', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 13,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04,
    shadowRadius: 5, elevation: 1,
  },
  scorePill: {
    justifyContent: 'center', minHeight: 26, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 13, backgroundColor: '#FEF9C3',
  },
  scorePillEmpty: { backgroundColor: '#F2F2F4' },
  // lineHeight esplicito: senza, il box del testo cambia con la dimensione del
  // font e la pillola "balla" fra una voce e l'altra.
  scoreNum: { fontSize: 14, fontWeight: '700', color: '#A16207', lineHeight: 20 },
  scoreMax: { fontSize: 11, fontWeight: '600', color: '#CA8A04', lineHeight: 20 },
  scoreEmptyText: { fontSize: 12, fontWeight: '600', color: '#A3A3AD', lineHeight: 20 },
  pagellinoRemove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pagellinoScaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pagellinoAdd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 48,
    borderRadius: 18, backgroundColor: '#F7F7F8', borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E9EBF2',
  },
  pagellinoAddText: { fontSize: 14.5, fontWeight: '600', color: '#6A6A6A' },
  pagellinoEmpty: { fontSize: 12.5, fontWeight: '500', color: '#A3A3AD', textAlign: 'center' },
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
