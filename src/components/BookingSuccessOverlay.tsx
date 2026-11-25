/**
 * REG-790 — il «quadratino» di conferma (Tiziano, 25/11/2026, flusso Airbnb):
 * a prenotazione (o scambio) riuscita il foglio si chiude SUBITO (niente
 * rotellina che gira sotto) e al centro dello schermo resta solo una card clay
 * bianca sul velo, con il video del cartello STOP che gira veloce e rallenta
 * morbido fino alla faccia verde «OK» (ease-out rimappato con ffmpeg, 1,3 s a
 * 60 fps). Poi la card sparisce in dissolvenza. Niente riepilogo dopo.
 *
 * Uso: `closeAndCelebrate(close, 'Prenotata')`. Su iOS la card vive in una
 * `FullWindowOverlay` (finestra sopra i fogli nativi che si stanno chiudendo).
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

const CARD = 220;
const ART = 168;
/** REG-792 (Tiziano): entrata morbida — velo 200 ms, card 240 ms da 0,92 a 1. */
const VEIL_IN_MS = 200;
const IN_MS = 240;
const OUT_MS = 200;
/** Il cartello parte quando la card è quasi entrata. */
const PLAY_AT_MS = 180;
/** Dopo la fine del video la spunta resta ferma un attimo prima di sparire. */
const HOLD_MS = 380;
/** Rete di sicurezza se il video non parte o non segnala la fine. */
const SAFETY_MS = 3200;
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
 * Chiude subito il foglio (la CTA non resta in caricamento) e mostra il
 * quadratino sopra la schermata sotto; si risolve quando è sparito.
 */
export async function closeAndCelebrate(close: () => void, label: string | null = null) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  const shown = playBookingSuccess(label);
  close();
  await shown;
}

const isActive = () => _req !== null;

/** True finché il quadratino è a schermo (REG-792: la home aspetta che sparisca). */
export function useBookingSuccessActive() {
  return useSyncExternalStore(store.subscribe, isActive);
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
  const veilShown = useSharedValue(0);
  const [leaving, setLeaving] = useState(false);
  const [play, setPlay] = useState(false);
  const finished = useRef(false);

  const leave = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    shown.value = withTiming(0, { duration: OUT_MS, easing: EASE, reduceMotion: N });
    veilShown.value = withTiming(0, { duration: OUT_MS, easing: EASE, reduceMotion: N });
    setTimeout(onDone, OUT_MS + 20);
  }, [onDone, shown, veilShown]);

  useEffect(() => {
    // Al fotogramma dopo il montaggio (il foglio sotto si sta chiudendo nello
    // stesso istante): così la dissolvenza parte intera, mai di botto.
    const raf = requestAnimationFrame(() => {
      veilShown.value = withTiming(1, { duration: VEIL_IN_MS, easing: EASE, reduceMotion: N });
      shown.value = withTiming(1, { duration: IN_MS, easing: EASE, reduceMotion: N });
    });
    const playT = setTimeout(() => setPlay(true), PLAY_AT_MS);
    const safety = setTimeout(leave, SAFETY_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(playT);
      clearTimeout(safety);
    };
  }, [leave, shown, veilShown]);

  const onStatus = useCallback(
    (st: AVPlaybackStatus) => {
      if (st.isLoaded && st.didJustFinish) setTimeout(leave, HOLD_MS);
    },
    [leave],
  );

  const veil = useAnimatedStyle(() => ({ opacity: veilShown.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.92 + 0.08 * shown.value }],
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
            shouldPlay={play}
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
  // Velo scuro leggero dietro il quadratino (Tiziano 25/11: «così è brutto»).
  veil: { backgroundColor: 'rgba(0,0,0,0.22)' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD,
    minHeight: CARD,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    // Ombra clay morbida e diffusa: alone largo + contatto vicino + luce interna in basso.
    boxShadow:
      '0 0 0 1px rgba(17,17,17,0.05), 0 32px 64px -14px rgba(0,0,0,0.34), 0 10px 22px -8px rgba(0,0,0,0.16), inset 0 -3px 5px rgba(0,0,0,0.04)',
  },
  art: { width: ART, height: ART, backgroundColor: '#FFFFFF' },
  label: { fontSize: 19, lineHeight: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4, marginTop: 2 },
});
