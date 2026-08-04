import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { useSession } from '../../../src/context/SessionContext';
import { regloApi } from '../../../src/services/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

type Point = { x: number; y: number };
type Stroke = Point[];

const STROKE_WIDTH = 3;
const STROKE_COLOR = '#1A1A2E';

const strokeToPath = (stroke: Stroke) => {
  if (stroke.length === 0) return '';
  const [first, ...rest] = stroke;
  // Un tap singolo deve comunque lasciare un punto visibile (round cap).
  if (rest.length === 0) return `M ${first.x} ${first.y} L ${first.x + 0.01} ${first.y}`;
  return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
};

export default function SignatureScreen() {
  const router = useRouter();
  const { refreshMe } = useSession();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasSize = useRef({ width: 0, height: 0 });
  // Ref specchio dello stato: i callback del PanResponder (creato una volta)
  // non vedono gli aggiornamenti di useState.
  const currentStrokeRef = useRef<Stroke>([]);
  const savingRef = useRef(false);
  savingRef.current = saving;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !savingRef.current,
      onMoveShouldSetPanResponder: () => !savingRef.current,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStrokeRef.current = [{ x: locationX, y: locationY }];
        setCurrentStroke([...currentStrokeRef.current]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStrokeRef.current = [
          ...currentStrokeRef.current,
          { x: locationX, y: locationY },
        ];
        setCurrentStroke([...currentStrokeRef.current]);
      },
      onPanResponderRelease: () => {
        const finished = currentStrokeRef.current;
        currentStrokeRef.current = [];
        setCurrentStroke(null);
        if (finished.length > 0) {
          setStrokes((prev) => [...prev, finished]);
        }
      },
      onPanResponderTerminate: () => {
        currentStrokeRef.current = [];
        setCurrentStroke(null);
      },
    }),
  ).current;

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
    currentStrokeRef.current = [];
  }, []);

  const handleConfirm = useCallback(async () => {
    if (strokes.length === 0 || saving) return;
    const { width, height } = canvasSize.current;
    if (!width || !height) return;
    setSaving(true);
    try {
      await regloApi.uploadSignature({
        strokes: strokes.map((points) => ({ points })),
        width,
        height,
        strokeWidth: STROKE_WIDTH,
      });
      await refreshMe();
      router.back();
    } catch (error) {
      Alert.alert(
        'Salvataggio non riuscito',
        error instanceof Error ? error.message : 'Riprova tra poco.',
      );
      setSaving(false);
    }
  }, [strokes, saving, refreshMe, router]);

  const hasInk = strokes.length > 0 || (currentStroke?.length ?? 0) > 0;
  const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Text style={s.title}>La tua firma</Text>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <Text style={s.hint}>Firma con il dito nel riquadro, come su carta.</Text>

      <View style={s.canvasWrap}>
      <View
        style={s.canvas}
        onLayout={(e) => {
          canvasSize.current = {
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          };
        }}
        {...panResponder.panHandlers}
      >
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {allStrokes.map((stroke, index) => (
            <Path
              key={index}
              d={strokeToPath(stroke)}
              stroke={STROKE_COLOR}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {!hasInk && (
          <View pointerEvents="none" style={s.placeholder}>
            <Ionicons name="create-outline" size={26} color="#C7C7CC" />
            <Text style={s.placeholderText}>Firma qui</Text>
          </View>
        )}
        <View pointerEvents="none" style={s.baseline} />
      </View>
      </View>

      <View style={s.footer}>
        <Pressable
          onPress={handleClear}
          disabled={!hasInk || saving}
          style={({ pressed }) => [
            s.secondaryBtn,
            pressed && { opacity: 0.85 },
            (!hasInk || saving) && { opacity: 0.4 },
          ]}
        >
          <Text style={s.secondaryBtnText}>Cancella</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleConfirm()}
          disabled={!hasInk || saving}
          style={({ pressed }) => [
            s.cta,
            pressed && { opacity: 0.85 },
            !hasInk && { opacity: 0.5 },
          ]}
        >
          <GradientCTABackground radius={26} />
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={s.ctaText}>Conferma firma</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  hint: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 16 },
  canvasWrap: { flex: 1, justifyContent: 'center' },
  // Striscia larga: la firma reale è orizzontale (il portale la vuole 30x6mm).
  canvas: {
    width: '100%',
    aspectRatio: 2.1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: { fontSize: 14, fontWeight: '500', color: '#C7C7CC' },
  baseline: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 36,
    height: 1,
    backgroundColor: '#E9EBF2',
  },
  footer: { flexDirection: 'row', gap: 12, marginTop: 20 },
  secondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  cta: {
    flex: 2,
    minHeight: 50,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
