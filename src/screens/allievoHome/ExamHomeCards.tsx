/**
 * Home allievo con un esame prenotato (anteprime approvate da Tiziano il
 * 10/11/2026: /tmp/hiro-anteprime/prenotazione-eccezioni/mob-1i, mob-1j,
 * mobile-v7-esame.html). L'esame è SEMPRE la card protagonista; sotto, la
 * prossima guida in una card compatta.
 *
 * Misure verificate col mockup (pt):
 * - inset interno 20 su TUTTE e due le card (bordi interni in colonna);
 * - card esame: padding alto 12 (+ l'aria della riga del numero = 22 ottici
 *   sopra l'inchiostro delle cifre), basso 22; numero 64/64 600, «giorni
 *   all'esame» 18 600 sulla stessa baseline; riga data 13.5/18, a capo vietato
 *   (puntini se la sede è lunga); icona 68 centrata sul blocco numero+riga;
 * - linea Oggi→Esame: dal centro del pallino «Oggi» (17) al centro della
 *   bandierina (26); pallini guida 13 in proporzione al tempo; «Oggi» allineata
 *   al bordo sinistro del suo pallino, «Esame» al bordo destro della bandierina;
 * - side-bearing ottica delle cifre compensata (`DIGIT_BEARING`): il bordo
 *   dell'inchiostro sta sul filo dei 20 pt come il testo sotto.
 */
import React, { memo, useCallback, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { ClayPressable, Icon3D } from '../../components/clay';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { CLAY_RADIUS } from '../../theme/spacing';
import { HOME_ART } from './HomeSections';

export const EXAM_TONE = {
  bg: '#F5F0FF',
  accent: '#8B5CF6',
  ink: '#4C1D95',
  sub: '#6D28D9',
  label: '#7C3AED',
  track: 'rgba(139,92,246,0.22)',
  glow: '#E6DAFF',
} as const;

/** Inset interno comune alle due card (Tiziano 10/11: bordi interni in colonna). */
export const EXAM_HOME_INSET = 20;

/**
 * Spazio vuoto a sinistra dell'inchiostro di ogni cifra, a 64 pt peso 600 nel
 * font di sistema (misurato con `measureText().actualBoundingBoxLeft`). Si
 * toglie col margine sinistro: il numero parte sul filo come la riga sotto.
 */
const DIGIT_BEARING: Record<string, number> = {
  '0': 2.7, '1': 2.9, '2': 2.9, '3': 2.6, '4': 2.3, '5': 3.6, '6': 2.6, '7': 2.1, '8': 2.7, '9': 3.2, O: 2.4,
};

const NOW_DOT = 17;
const FLAG = 26;
const GUIDE_DOT = 13;

export const ExamHeroCard = memo(function ExamHeroCard({
  big,
  unit,
  whenLine,
  lessonPositions,
  onPress,
}: {
  /** Numero grande («22») o «Oggi» il giorno dell'esame. */
  big: string;
  /** «giorni all'esame», «giorno all'esame», «è il giorno dell'esame». */
  unit: string;
  /** «4 dic · 9:30 · Motorizzazione Torino» (una riga, puntini se lunga). */
  whenLine: string;
  /** Guide fissate prima dell'esame: posizione 0–1 sulla linea Oggi→Esame. */
  lessonPositions: number[];
  onPress: () => void;
}) {
  const [trackW, setTrackW] = useState(0);
  const onTrack = useCallback((e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width), []);
  const from = NOW_DOT / 2;
  const to = trackW - FLAG / 2;
  const bearing = DIGIT_BEARING[big.charAt(0)] ?? 0;

  return (
    <ClayPressable
      kind="card"
      onPress={onPress}
      style={s.hero}
      accessibilityRole="button"
      accessibilityLabel={`Esame: ${big} ${unit}, ${whenLine}`}
      testID="home-exam-card"
    >
      {/* Il ritaglio sta su un figlio: sul contenitore taglierebbe l'ombra. */}
      <View style={s.heroClip}>
        <Svg style={s.glow} width={250} height={250} pointerEvents="none">
          <Defs>
            <RadialGradient id="examGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={EXAM_TONE.glow} stopOpacity={1} />
              <Stop offset="0.68" stopColor={EXAM_TONE.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={250} height={250} fill="url(#examGlow)" />
        </Svg>
        <View style={s.heroIn}>
          <View style={s.head}>
            <View style={s.headText}>
              <View style={s.numRow}>
                <Text style={[s.big, { marginLeft: -bearing }]} allowFontScaling={false}>
                  {big}
                </Text>
                <Text style={s.unit} numberOfLines={1}>
                  {unit}
                </Text>
              </View>
              <Text style={s.when} numberOfLines={1} ellipsizeMode="tail">
                {whenLine}
              </Text>
            </View>
            <Icon3D source={HOME_ART.esame} size={68} />
          </View>

          <View style={s.road}>
            <View style={s.track} onLayout={onTrack}>
              <View style={[s.line, { left: from, right: FLAG / 2 }]} />
              {trackW > 0
                ? lessonPositions.map((p, i) => (
                    <View
                      key={i}
                      style={[s.dot, { left: from + Math.min(1, Math.max(0, p)) * (to - from) - GUIDE_DOT / 2 }]}
                    />
                  ))
                : null}
              <View style={s.now} />
              <View style={s.flag}>
                <Svg width={12} height={12} viewBox="0 0 12 12">
                  <Path
                    d="M3.5 1.5v9M3.5 2h5.5l-1.5 2L9 6H3.5"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>
            <View style={s.labels}>
              <Text style={s.label}>Oggi</Text>
              <Text style={s.label}>Esame</Text>
            </View>
          </View>
        </View>
      </View>
    </ClayPressable>
  );
});

/** Prossima guida, ridotta: ritaglio dell'immagine + due righe. */
export const CompactLessonCard = memo(function CompactLessonCard({
  kicker,
  title,
  onPress,
}: {
  /** «Prossima guida · tra 2 giorni», «Ultima guida · domani». */
  kicker: string;
  /** «Ven 14 nov · 15:00 – 16:00». */
  title: string;
  onPress: () => void;
}) {
  return (
    <ClayPressable
      kind="card"
      onPress={onPress}
      style={s.compact}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}, ${title}`}
      testID="home-next-lesson-compact"
    >
      <View style={s.thumb}>
        <Image source={HOME_ART.hero} style={s.thumbImg} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
      <View style={s.compactText}>
        <Text style={s.kicker} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} />
    </ClayPressable>
  );
});

const s = StyleSheet.create({
  hero: {
    marginTop: 22,
    borderRadius: 30,
    backgroundColor: EXAM_TONE.bg,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: 'rgba(139,92,246,0.18)' },
      { offsetX: 0, offsetY: 14, blurRadius: 30, spreadDistance: -12, color: 'rgba(139,92,246,0.30)' },
      { offsetX: 0, offsetY: -3, blurRadius: 5, spreadDistance: 0, color: 'rgba(76,29,149,0.05)', inset: true },
    ],
  },
  heroClip: { borderRadius: 30, overflow: 'hidden' },
  glow: { position: 'absolute', right: -60, top: -70 },
  heroIn: { paddingTop: 12, paddingBottom: 22, paddingHorizontal: EXAM_HOME_INSET },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headText: { flex: 1, minWidth: 0 },
  numRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontSize: 64, lineHeight: 64, fontWeight: '600', color: EXAM_TONE.ink, letterSpacing: -2.6 },
  unit: { flexShrink: 1, fontSize: 18, fontWeight: '600', color: EXAM_TONE.ink, letterSpacing: -0.4 },
  when: { fontSize: 13.5, lineHeight: 18, color: EXAM_TONE.sub, marginTop: 8 },
  road: { marginTop: 22 },
  track: { height: FLAG, justifyContent: 'center' },
  line: { position: 'absolute', top: 11.5, height: 3, borderRadius: 2, backgroundColor: EXAM_TONE.track },
  dot: {
    position: 'absolute',
    top: (FLAG - GUIDE_DOT) / 2,
    width: GUIDE_DOT,
    height: GUIDE_DOT,
    borderRadius: GUIDE_DOT / 2,
    backgroundColor: '#FFFFFF',
    // Anello fuori dal cerchio (come il mockup): 13 bianco + 2,5 viola.
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2.5, color: EXAM_TONE.accent },
      { offsetX: 0, offsetY: 2, blurRadius: 4, spreadDistance: 0, color: 'rgba(76,29,149,0.25)' },
    ],
  },
  now: {
    position: 'absolute',
    left: 0,
    top: (FLAG - NOW_DOT) / 2,
    width: NOW_DOT,
    height: NOW_DOT,
    borderRadius: NOW_DOT / 2,
    backgroundColor: EXAM_TONE.ink,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3, color: EXAM_TONE.bg }],
  },
  flag: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: FLAG,
    height: FLAG,
    borderRadius: FLAG / 2,
    backgroundColor: EXAM_TONE.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3, color: EXAM_TONE.bg }],
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontSize: 12.5, lineHeight: 16, color: EXAM_TONE.label },

  compact: {
    marginTop: 14,
    borderRadius: CLAY_RADIUS.card,
    backgroundColor: CLAY.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 17,
    paddingHorizontal: EXAM_HOME_INSET,
    ...CLAY_SHADOW.raise,
  },
  thumb: { width: 80, height: 58, borderRadius: 16, overflow: 'hidden', backgroundColor: CLAY.surface },
  // Ritaglio dell'immagine della home centrato sull'auto (come il mockup:
  // cover + zoom 1,9 centrato al 50%/55%).
  thumbImg: { position: 'absolute', width: 330, height: 110, left: -125, top: -29 },
  compactText: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3 },
  title: { fontSize: 16.5, lineHeight: 21, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, marginTop: 2 },
});
