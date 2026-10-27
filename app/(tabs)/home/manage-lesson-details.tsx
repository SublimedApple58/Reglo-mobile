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
import { useRouter } from 'expo-router';
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
  /** Voci che questa guida ha già salvato (tengono visibili le voci archiviate). */
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
  // REG-638: aperto da Reglo Road = solo pagellino, CTA nera.
  const road = data.road ?? null;
  const showEsito = data.showEsito === true && !road;
  // Il tipo cambierebbe il `type` dell'appuntamento: nascosto su esami/gruppi
  // (ne romperebbe la categoria). Nel flusso home questo foglio si apre solo per
  // guide individuali, quindi il gate è un no-op lì.
  const lessonTypeLc = (lesson.type ?? '').toLowerCase();
  // Le guide moto usano "Tipo guida moto" (birilli/strada) → il "Tipo guida"
  // generico (attività) è ridondante e va nascosto.
  const isMotoLesson =
    isMotoLicenseCategory(lesson.vehicle?.licenseCategory) ||
    isMotoLicenseCategory(lesson.student?.licenseCategory);
  /**
   * Tutte le voci del pagellino della scuola, subito, ognuna con le sue
   * stelline (QA Road 27/10): l'istruttore valuta solo quelle che vuole, le
   * altre restano «non valutate». Le voci archiviate compaiono solo se questa
   * guida le aveva già votate.
   */
  const evalRows = evalItems.filter((item) => !item.archived || evalAdded.includes(item.id));
  const ratedCount = evalRows.filter((item) => legacyNa[item.id] || scores[item.id] != null).length;
  const showTypes =
    !road &&
    lessonTypeLc !== 'group_lesson' && lessonTypeLc !== 'esame' && !lesson.groupLessonId && !isMotoLesson;


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

  const topBar = (
      <View style={s.topBar}>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={road ? '#3A3A3C' : '#111111'} />
          </Pressable>
        </GlassCloseButton>
      </View>
  );
  const saveFooter = (
          <View style={{ paddingBottom: Math.max(insets.bottom, road ? 18 : 12) }}>
            <Pressable
              onPress={handleSave}
              disabled={!editable}
              style={({ pressed }) => [
                s.saveBtn,
                road ? null : s.saveFooter,
                road && s.saveBtnRoad,
                pressed && { opacity: 0.9 },
                !editable && { opacity: 0.4 },
              ]}
            >
              {road ? null : <GradientCTABackground radius={27} />}
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.saveText}>Salva</Text>
              )}
            </Pressable>
          </View>
  );
  const content = (
    <>
      {road ? (
        // Titolo e allievo stanno nella barra del foglio: qui al massimo la
        // riga discreta «resti in Road».
        road.showStayChip ? <Text style={s.roadStay}>Resti in Road: il percorso continua.</Text> : null
      ) : (
        <View style={s.headerBlock}>
          <Text style={s.title}>Dettagli guida</Text>
          <Text style={s.subtitle}>Tipo, pagellino e note di questa guida.</Text>
        </View>
      )}

      {/* Tipo guida — collapse while typing notes so the sheet
          shrinks and the textarea floats above the keyboard. */}
      <Animated.View
        // In Road il blocco è vuoto (niente tipo/esito): niente spazio fantasma.
        style={[s.collapsible, collapsibleStyle, road && s.collapsibleRoad]}
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

      {/* Pagellino dell'autoscuola: tutte le voci subito, ognuna con le sue
          stelline; l'istruttore valuta solo quelle che vuole e le altre restano
          «non valutate» (QA Road 27/10). Nessun vincolo di stato: si compila
          anche a metà guida o prima del check-in. Resta fuori solo dalle guide
          annullate senza voti, dove sarebbe solo rumore. */}
      {evalItems.length > 0 && (isDetailsEditable || hasSavedScores) ? (
        <Animated.View
          layout={LAYOUT}
          entering={FadeIn.duration(260)}
          style={[s.section, { marginBottom: 20 }]}
        >
          <View style={[s.pagellinoHead, road && s.pagellinoHeadRoad]}>
            {road ? null : <Text style={s.sectionLabel}>Pagellino</Text>}
            {evalRows.length > 0 ? (
              <Animated.Text
                key={ratedCount}
                entering={FadeIn.duration(180)}
                style={s.pagellinoHint}
              >
                {ratedCount === 0
                  ? `${evalRows.length} ${evalRows.length === 1 ? 'voce' : 'voci'}`
                  : `${ratedCount} su ${evalRows.length} ${ratedCount === 1 ? 'valutata' : 'valutate'}`}
              </Animated.Text>
            ) : null}
          </View>

          {editable && evalRows.length > 0 ? (
            <Text style={s.pagellinoLead}>
              Tocca le stelline delle voci che vuoi valutare. Le altre restano «non valutate».
            </Text>
          ) : null}

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
                        style={[s.pagellinoLabel, (isNa || !scores[item.id]) && s.pagellinoLabelOff]}
                        numberOfLines={2}
                      >
                        {item.label}
                        {item.archived ? ' (non più in uso)' : ''}
                      </Text>
                      {/* Punteggio come testo semplice accanto al nome (niente
                          pillole): senza voto bastano le stelline vuote.
                          UN SOLO Text con figlio annidato, così "4" e "/5"
                          restano sulla stessa linea di base. */}
                      {isNa || !scores[item.id] ? null : (
                        <Animated.Text
                          key={scores[item.id]}
                          entering={FadeIn.duration(150)}
                          style={s.scoreNum}
                        >
                          {scores[item.id]}
                          <Text style={s.scoreMax}>/{item.scaleMax}</Text>
                        </Animated.Text>
                      )}
                    </View>
                    {isNa ? (
                      <Text style={s.pagellinoValue}>{EVALUATION_NOT_APPLICABLE_LABEL}</Text>
                    ) : null}
                    {isNa && !editable ? null : (
                      <View style={s.pagellinoScaleRow}>
                        <StarRating
                          value={value}
                          total={item.scaleMax}
                          tone="gold"
                          size={starSizeForScale(item.scaleMax)}
                          onChange={
                            editable
                              ? (next) => {
                                  setScores((prev) => {
                                    const copy = { ...prev };
                                    // Ritoccare la stellina già scelta svuota il
                                    // voto: la voce torna «non valutata».
                                    if (!next) delete copy[item.id];
                                    else copy[item.id] = next;
                                    return copy;
                                  });
                                  if (legacyNa[item.id]) {
                                    setLegacyNa((prev) => {
                                      const copy = { ...prev };
                                      delete copy[item.id];
                                      return copy;
                                    });
                                  }
                                }
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

      {/* Note (non da Road: lì il foglio è solo il pagellino) */}
      {road ? null : (
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
      )}
    </>
  );

  if (road) {
    // Da Road (feedback Tiziano 27/10): foglio nativo vero. Barra in alto con
    // titolo «Pagellino» + allievo e la X, corpo che scorre, «Salva» fisso in
    // fondo. Detent fisso (ROAD_PAGELLINO_SHEET) perché il footer sia ancorato.
    return (
      <View style={s.roadRoot}>
        <View style={s.navBar}>
          <View style={s.navSide} />
          <View style={s.navTitles}>
            <Text style={s.navTitle} numberOfLines={1}>Pagellino</Text>
            <Text style={s.navSub} numberOfLines={1}>{road.subtitle}</Text>
          </View>
          <View style={[s.navSide, { alignItems: 'flex-end' }]}>
            <GlassCloseButton onPress={() => router.back()}>
              <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
                <Ionicons name="close" size={20} color="#3A3A3C" />
              </Pressable>
            </GlassCloseButton>
          </View>
        </View>
        <SheetScaffold
          fill
          contentContainerStyle={[s.scaffoldBody, s.roadBody]}
          footer={<View style={s.roadFooter}>{saveFooter}</View>}
        >
          {content}
        </SheetScaffold>
      </View>
    );
  }

  return (
    // Home/note: PAGE_SHEET, il root riempie lo schermo e il corpo scorre
    // (SheetScaffold `fill`) con «Salva» agganciato in fondo.
    <View style={[s.root, { flex: 1 }]}>
      {topBar}
      <SheetScaffold
        fill
        keyboardAware
        // Coda del contenuto: senza, l'ultima voce del pagellino finisce
        // incollata al bordo del "Salva" e sembra tagliata.
        contentContainerStyle={[s.scaffoldBody, { paddingBottom: 28, flexGrow: 1 }]}
        footer={saveFooter}
      >
        {content}
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
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '600', color: '#111111', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  collapsible: { gap: 20, paddingBottom: 20, overflow: 'hidden' },
  collapsibleRoad: { paddingBottom: 0, height: 0 },
  section: { gap: 12 },
  esitoRow: { flexDirection: 'row', gap: 6, backgroundColor: '#F2F2F4', borderRadius: 12, padding: 4 },
  esitoBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 9 },
  esitoBtnActive: { backgroundColor: '#FFFFFF' },
  esitoText: { fontSize: 14, fontWeight: '600', color: '#8A8A8F' },
  esitoTextPresente: { color: '#047857' },
  esitoTextAssente: { color: '#B91C1C' },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: '#111111', letterSpacing: -0.3 },
  pagellinoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pagellinoHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  pagellinoLead: { fontSize: 13.5, fontWeight: '400', color: '#6A6A6A', lineHeight: 19, marginBottom: 12, marginTop: -2 },
  pagellinoCard: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', borderRadius: 16,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14,
  },
  pagellinoItem: { paddingVertical: 12, gap: 6 },
  pagellinoItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1F1F3' },
  pagellinoItemTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  pagellinoLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111111' },
  pagellinoLabelOff: { color: '#A3A3A3' },
  voiceCard: {
    borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EFEFF2', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 13,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04,
    shadowRadius: 5, elevation: 1,
  },
  scoreNum: { fontSize: 14, fontWeight: '600', color: '#111111', lineHeight: 20, fontVariant: ['tabular-nums'] },
  scoreMax: { fontSize: 12, fontWeight: '500', color: '#8E8E93', lineHeight: 20 },
  pagellinoScaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pagellinoEmpty: { fontSize: 12.5, fontWeight: '500', color: '#A3A3A3', textAlign: 'center' },
  pagellinoValue: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notes: {
    minHeight: 110, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ECECEC', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, color: '#111111', backgroundColor: '#F7F7F7',
    textAlignVertical: 'top', fontSize: 15, lineHeight: 22,
  },

  saveBtn: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    ...primaryCtaShadow,
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  // REG-638: in Road niente navy, CTA nera piena.
  saveBtnRoad: { backgroundColor: '#111111', shadowColor: '#111111', shadowOpacity: 0.18 },
  // Road: foglio con barra nativa, corpo che scorre, «Salva» fisso.
  roadRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  navBar: {
    flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 14, paddingTop: 8,
    paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E2E2',
  },
  navSide: { width: 48 },
  navTitles: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 17, fontWeight: '600', color: '#111111', letterSpacing: -0.4 },
  navSub: { fontSize: 13, fontWeight: '400', color: '#6A6A6A', marginTop: 1 },
  roadBody: { paddingHorizontal: spacing.lg, paddingTop: 18, paddingBottom: 24 },
  roadFooter: {
    paddingHorizontal: spacing.lg, paddingTop: 12, backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E2E2',
  },
  roadStay: { fontSize: 13.5, fontWeight: '400', color: '#6A6A6A', marginBottom: -6 },
  pagellinoHeadRoad: { justifyContent: 'flex-start' },
});
