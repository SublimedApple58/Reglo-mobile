/**
 * REG-790 — il «quadratino» di conferma (Tiziano, 25/11/2026, flusso Airbnb):
 * a prenotazione (o scambio) riuscita, al centro dello schermo e SOPRA i form
 * sheet compare una card clay bianca con il video del cartello STOP che gira e
 * si ferma sulla faccia verde «OK». Finito il video la card sparisce in
 * dissolvenza e chi l'ha chiamata chiude il foglio. Niente riepilogo dopo.
 *
 * Uso: `await celebrateThenClose(close, 'Prenotata')`. Su iOS la card vive in
 * una `FullWindowOverlay` (finestra sopra i fogli nativi), poi si chiude il
 * foglio; su Android i fogli non stanno sotto la finestra RN, quindi prima si
 * chiude il foglio e poi compare la card sulla schermata.
 *
 * Il video: `expo-av` (già nella build nativa → OTA), una sola riproduzione,
 * muto, primo fotogramma come poster (niente scatto), sfondo bianco puro come
 * la card. «Riduci movimento» non spegne niente (regola fissa).
 */
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { CLAY } from '../theme/clay';

const STOP_OK_VIDEO = require('../../assets/conferma/stop-ok.mp4');
const STOP_OK_POSTER = require('../../assets/conferma/stop-ok-primo.png');

const CARD = 176;
const ART = 132;
const IN_MS = 220;
const OUT_MS = 240;
/** Dopo la fine del video la spunta resta ferma un attimo prima di sparire. */
const HOLD_MS = 450;
/** Rete di sicurezza se il video non parte o non segnala la fine. */
const SAFETY_MS = 4200;
const N = ReduceMotion.Never;
const EASE = Easing.out(Easing.cubic);

type Request = { id: number; label: string | null; done: () => void };

let _req: Request | null = null;
let _seq = 0;
const _listeners = new Set<() => void>();
const emit = () => _listeners.forEach((fn) => fn());

const store = {
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
  get: () => _req,
};

/** Mostra il quadratino; si risolve quando è sparito. */
export function playBookingSuccess(label: string | null = null): Promise<void> {
  return new Promise((resolve) => {
    _req?.done();
    const id = ++_seq;
    _req = {
      id,
      label,
      done: () => {
        if (_req?.id === id) {
          _req = null;
          emit();
        }
        resolve();
      },
    };
    emit();
  });
}

/**
 * Il momento di conferma e poi la chiusura del foglio, nell'ordine giusto per
 * la piattaforma (vedi testa del file).
 */
export async function celebrateThenClose(close: () => void, label: string | null = null) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  if (Platform.OS === 'ios') {
    await playBookingSuccess(label);
    close();
    return;
  }
  close();
  await new Promise((r) => setTimeout(r, 300));
  await playBookingSuccess(label);
}

/** Montato una volta nel layout radice. */
export function BookingSuccessHost() {
  const req = useSyncExternalStore(store.subscribe, store.get);
  if (!req) return null;
  const card = <SuccessCard key={req.id} label={req.label} onDone={req.done} />;
  return Platform.OS === 'ios' ? <FullWindowOverlay>{card}</FullWindowOverlay> : card;
}

function SuccessCard({ label, onDone }: { label: string | null; onDone: () => void }) {
  const shown = useSharedValue(0);
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);

  const leave = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    shown.value = withTiming(0, { duration: OUT_MS, easing: EASE, reduceMotion: N });
    setTimeout(onDone, OUT_MS + 20);
  }, [onDone, shown]);

  useEffect(() => {
    shown.value = withTiming(1, { duration: IN_MS, easing: EASE, reduceMotion: N });
    const safety = setTimeout(leave, SAFETY_MS);
    return () => clearTimeout(safety);
  }, [leave, shown]);

  const onStatus = useCallback(
    (st: AVPlaybackStatus) => {
      if (st.isLoaded && st.didJustFinish) setTimeout(leave, HOLD_MS);
    },
    [leave],
  );

  const veil = useAnimatedStyle(() => ({ opacity: shown.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.94 + 0.06 * shown.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={leaving ? 'none' : 'auto'} testID="booking-success">
      <Animated.View style={[StyleSheet.absoluteFill, s.veil, veil]} />
      <View style={s.center} pointerEvents="none">
        <Animated.View style={[s.card, cardStyle]} accessible accessibilityRole="alert" accessibilityLabel={label ?? 'Fatto'}>
          <Video
            source={STOP_OK_VIDEO}
            style={s.art}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isMuted
            isLooping={false}
            usePoster
            posterSource={STOP_OK_POSTER}
            posterStyle={s.art}
            onPlaybackStatusUpdate={onStatus}
          />
          {label ? <Text style={s.label}>{label}</Text> : null}
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  veil: { backgroundColor: 'rgba(17,17,17,0.10)' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD,
    minHeight: CARD,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    boxShadow: '0 0 0 1px rgba(17,17,17,0.05), 0 24px 48px -16px rgba(0,0,0,0.28), inset 0 -3px 5px rgba(0,0,0,0.04)',
  },
  art: { width: ART, height: ART, backgroundColor: '#FFFFFF' },
  label: { fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2, marginTop: 2 },
});
