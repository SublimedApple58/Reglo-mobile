import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useDoneAccessory } from '../../../src/components/KeyboardDoneAccessory';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { lessonDetailsStore } from '../../../src/stores/lessonDetailsStore';
import { StarRating } from '../../../src/components/StarRating';
import { LESSON_TYPE_OPTIONS, resolveInitialLessonTypes } from '../../../src/utils/lessonTypes';
import {
  EVALUATION_NOT_APPLICABLE_LABEL,
  starSizeForScale,
} from '../../../src/utils/evaluationSheet';
import { regloApi } from '../../../src/services/regloApi';
import type { EvaluationItem } from '../../../src/types/regloApi';
import { isMotoLicenseCategory } from '../../../src/utils/license';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayField, ClayList, ClayListRow, ClaySection } from '../../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../../src/theme/clay';
import { SOFT_LAYOUT } from '../../../src/utils/motion';

/**
 * Transizione di posizione condivisa da tutto il blocco pagellino: quando una
 * voce entra o esce, le altre card (e il bottone sotto) scivolano al loro posto
 * senza rimbalzo invece di saltarci.
 */
const LAYOUT = SOFT_LAYOUT;

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
    return <View style={s.empty} />;
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

  const toggleType = (value: string) => {
    if (!editable) return;
    setTypes((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((t) => t !== value);
        return next.length ? next : [value];
      }
      return [...prev, value];
    });
  };
  const check = <Ionicons name="checkmark" size={22} color={CLAY.ink} accessibilityLabel="Selezionato" />;

  return (
    // IL form sheet (FORM_SHEET + FormSheet, §13.2) sia da Road (solo
    // pagellino) sia dalla home/note (tipo, esito, pagellino, note).
    <FormSheet
      title={road ? 'Pagellino' : 'Dettagli guida'}
      subtitle={road ? road.subtitle : 'Tipo, pagellino e note di questa guida.'}
      testID={road ? 'road-pagellino-sheet' : 'lesson-details-sheet'}
      cta={
        <ClayButton
          title="Salva"
          onPress={handleSave}
          disabled={!editable}
          loading={saving}
          testID={road ? 'pagellino-save' : 'lesson-details-save'}
        />
      }
    >
      <View style={s.body}>
        {/* Da Road al massimo la riga discreta «resti in Road». */}
        {road?.showStayChip ? <Text style={s.roadStay}>Resti in Road: il percorso continua.</Text> : null}

        {/* Tipo guida + esito — si chiudono mentre si scrivono le note, così il
            foglio si accorcia e il campo resta sopra la tastiera. */}
        {showTypes || showEsito ? (
          <Animated.View
            style={[s.collapsible, collapsibleStyle]}
            pointerEvents={notesFocused ? 'none' : 'auto'}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0 && collapse.value === 0) collapsibleH.value = h;
            }}
          >
            {showTypes ? (
              <ClaySection title="Tipo guida" style={s.sec}>
                <ClayList>
                  {LESSON_TYPE_OPTIONS.map((option) => (
                    <ClayListRow
                      key={option.value}
                      title={option.label}
                      onPress={editable ? () => toggleType(option.value) : undefined}
                      chevron={false}
                      trailing={types.includes(option.value) ? check : null}
                      testID={`lesson-type-${option.value}`}
                    />
                  ))}
                </ClayList>
              </ClaySection>
            ) : null}

            {/* Esito (solo storico): si sceglie o si toglie, come prima. */}
            {showEsito ? (
              <ClaySection title="Esito" style={s.sec}>
                <ClayList>
                  <ClayListRow
                    title="Presente"
                    onPress={editable ? () => setEsito((e) => (e === 'checked_in' ? null : 'checked_in')) : undefined}
                    chevron={false}
                    trailing={esito === 'checked_in' ? check : null}
                    testID="lesson-esito-presente"
                  />
                  <ClayListRow
                    title="Assente"
                    onPress={editable ? () => setEsito((e) => (e === 'no_show' ? null : 'no_show')) : undefined}
                    chevron={false}
                    trailing={esito === 'no_show' ? check : null}
                    testID="lesson-esito-assente"
                  />
                </ClayList>
              </ClaySection>
            ) : null}

            {/* La valutazione a stellina singola non si compila più: al suo posto
                c'è il pagellino qui sotto. I voti già dati restano leggibili nello
                storico guide, sulle guide che non hanno il pagellino. */}
          </Animated.View>
        ) : null}

        {/* Pagellino dell'autoscuola: tutte le voci subito, ognuna con le sue
            stelline; l'istruttore valuta solo quelle che vuole e le altre restano
            «non valutate» (QA Road 27/10). Nessun vincolo di stato: si compila
            anche a metà guida o prima del check-in. Resta fuori solo dalle guide
            annullate senza voti, dove sarebbe solo rumore. */}
        {evalItems.length > 0 && (isDetailsEditable || hasSavedScores) ? (
          <Animated.View layout={LAYOUT} entering={FadeIn.duration(260).reduceMotion(ReduceMotion.Never)}>
            <ClaySection
              title={road ? undefined : 'Pagellino'}
              style={s.sec}
              action={
                evalRows.length > 0 ? (
                  <Animated.Text
                    key={ratedCount}
                    entering={FadeIn.duration(180).reduceMotion(ReduceMotion.Never)}
                    style={s.pagellinoHint}
                  >
                    {ratedCount === 0
                      ? `${evalRows.length} ${evalRows.length === 1 ? 'voce' : 'voci'}`
                      : `${ratedCount} su ${evalRows.length} ${ratedCount === 1 ? 'valutata' : 'valutate'}`}
                  </Animated.Text>
                ) : undefined
              }
            >
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
                        entering={FadeInDown.duration(240).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.Never)}
                        exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.Never)}
                        style={[s.voiceCard, CLAY_SHADOW.raise]}
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
                              entering={FadeIn.duration(150).reduceMotion(ReduceMotion.Never)}
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
                  entering={FadeIn.duration(200).reduceMotion(ReduceMotion.Never)}
                  exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.Never)}
                  style={s.pagellinoEmpty}
                >
                  Nessuna voce: questa guida non ha ancora un pagellino.
                </Animated.Text>
              ) : null}
            </ClaySection>
          </Animated.View>
        ) : null}

        {/* Note (non da Road: lì il foglio è solo il pagellino) */}
        {road ? null : (
          <ClaySection title="Note" style={s.sec}>
            <ClayField
              value={notes}
              onChangeText={setNotes}
              onFocus={() => setNotesFocused(true)}
              onBlur={() => setNotesFocused(false)}
              placeholder="Aggiungi note operative o osservazioni."
              multiline
              editable={editable}
              inputAccessoryViewID={accessoryID}
              accessibilityLabel="Note"
              testID="lesson-details-notes"
            />
          </ClaySection>
        )}
      </View>
      {accessory}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  body: { gap: 26 },
  // Lo spazio fra le sezioni lo dà `body` (gap), non il margine di ClaySection.
  sec: { marginTop: 0 },
  collapsible: { gap: 26, overflow: 'hidden' },
  pagellinoHint: { fontSize: 13, fontWeight: '500', color: CLAY.ink3 },
  pagellinoLead: { fontSize: 14, fontWeight: '400', color: CLAY.ink3, lineHeight: 19, marginBottom: 14, paddingHorizontal: 2 },
  pagellinoItemTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  pagellinoLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  pagellinoLabelOff: { color: CLAY.ink3 },
  // Voci in rilievo clay sul bianco (come in Road).
  voiceCard: {
    borderRadius: 22, backgroundColor: CLAY.surface,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 13,
    marginBottom: 12,
  },
  scoreNum: { fontSize: 14, fontWeight: '600', color: CLAY.ink, lineHeight: 20, fontVariant: ['tabular-nums'] },
  scoreMax: { fontSize: 12, fontWeight: '500', color: CLAY.ink3, lineHeight: 20 },
  pagellinoScaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pagellinoEmpty: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, textAlign: 'center' },
  pagellinoValue: { fontSize: 13, fontWeight: '500', color: CLAY.ink3 },
  roadStay: { fontSize: 14, fontWeight: '400', color: CLAY.ink3 },
});
