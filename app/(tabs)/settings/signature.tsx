import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../../src/context/SessionContext';
import { regloApi } from '../../../src/services/regloApi';

type Point = { x: number; y: number };
type Stroke = Point[];

const STROKE_WIDTH = 3;
const STROKE_COLOR = '#1A1A2E';
const NAVY = '#1A1A2E';

const strokeToPath = (stroke: Stroke) => {
  if (stroke.length === 0) return '';
  const [first, ...rest] = stroke;
  // Un tap singolo deve comunque lasciare un punto visibile (round cap).
  if (rest.length === 0) return `M ${first.x} ${first.y} L ${first.x + 0.01} ${first.y}`;
  return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
};

/**
 * Firma a TUTTO SCHERMO in orizzontale: l'app è portrait-locked, quindi la UI
 * viene ruotata di 90° via transform — l'utente gira il telefono e firma su
 * tutta la superficie. Niente sheet/modal: route fullScreenModal.
 * Le coordinate del PanResponder restano nello spazio locale (non ruotato)
 * del canvas, quindi il disegno e l'invio dei tratti non cambiano.
 */
export default function SignatureScreen() {
  const router = useRouter();
  const { refreshMe } = useSession();
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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

  // Contenitore ruotato di 90°: occupa winH x winW centrato sullo schermo.
  // Il bordo locale SINISTRO coincide col bordo superiore fisico (notch) e
  // quello DESTRO con quello inferiore (home indicator) → padding dagli insets.
  const rotated = {
    position: 'absolute' as const,
    width: winH,
    height: winW,
    top: (winH - winW) / 2,
    left: (winW - winH) / 2,
    transform: [{ rotate: '90deg' }],
    paddingLeft: Math.max(insets.top, 16),
    paddingRight: Math.max(insets.bottom, 16),
  };

  return (
    <View style={s.root}>
      <StatusBar hidden />
      <View style={rotated}>
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
              <Ionicons name="create-outline" size={30} color="#D5D5DA" />
              <Text style={s.placeholderText}>Firma qui, in orizzontale, su tutto lo schermo</Text>
            </View>
          )}
          <View pointerEvents="none" style={s.baseline} />
        </View>

        {/* Comandi sospesi: Cancella a sinistra, Annulla + Fatto in alto a destra */}
        <View style={s.topBar} pointerEvents="box-none">
          {hasInk && !saving ? (
            <Pressable onPress={handleClear} style={({ pressed }) => [s.ghostBtn, pressed && { opacity: 0.7 }]}>
              <Text style={s.ghostText}>Cancella</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={s.topRight}>
            <Pressable
              onPress={() => router.back()}
              disabled={saving}
              style={({ pressed }) => [s.ghostBtn, pressed && { opacity: 0.7 }, saving && { opacity: 0.4 }]}
            >
              <Text style={s.ghostText}>Annulla</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleConfirm()}
              disabled={!hasInk || saving}
              style={({ pressed }) => [s.doneBtn, pressed && { opacity: 0.85 }, !hasInk && { opacity: 0.4 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.doneText}>Fatto</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  canvas: { flex: 1, backgroundColor: '#FFFFFF' },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: { fontSize: 15, fontWeight: '500', color: '#C7C7CC' },
  baseline: {
    position: 'absolute',
    left: 60,
    right: 60,
    bottom: 64,
    height: 1,
    backgroundColor: '#E9EBF2',
  },
  topBar: {
    position: 'absolute',
    top: 14,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ghostBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F1F2F4',
  },
  ghostText: { fontSize: 15, fontWeight: '600', color: NAVY },
  doneBtn: {
    minWidth: 88,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: NAVY,
  },
  doneText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
