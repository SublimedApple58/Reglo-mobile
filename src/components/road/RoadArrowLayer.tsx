import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type MapView from 'react-native-maps';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { SOFT } from '../../utils/motion';

type LatLng = { latitude: number; longitude: number };
type Arrow = { at: LatLng; bearing: number };

export type ArrowLayerHandle = { place: () => void; hide: () => void };

/** Distanza minima a schermo fra due frecce. */
const GAP_PX = 64;
/** Di quanto (m) si guarda avanti per la direzione a schermo. */
const AHEAD_M = 6;
const SIZE = 10;

/**
 * REG-723 — frecce leggerissime del verso di marcia sopra la mappa del
 * riepilogo. Stanno FUORI dalla MapView (dentro niente cambia dopo il
 * montaggio, REG-715): a mappa ferma si proiettano i punti candidati e se ne
 * tengono alcuni distanziati a schermo, così restano piccole a ogni zoom e la
 * direzione è quella a schermo (anche con la mappa ruotata). Mentre la mappa si
 * muove spariscono e tornano in dissolvenza.
 */
export const RoadArrowLayer = forwardRef<
  ArrowLayerHandle,
  { mapRef: React.RefObject<MapView | null>; arrows: Arrow[]; sizeRef: React.MutableRefObject<{ w: number; h: number }> }
>(function RoadArrowLayer({ mapRef, arrows, sizeRef }, ref) {
  const [shown, setShown] = useState<Array<{ x: number; y: number; deg: number }>>([]);
  const k = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: k.value }));
  const run = useRef(0);

  const hide = useCallback(() => {
    run.current += 1;
    k.value = withTiming(0, { duration: 100, easing: SOFT, reduceMotion: ReduceMotion.Never });
  }, [k]);

  const place = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !arrows.length) return;
    const id = ++run.current;
    const rad = Math.PI / 180;
    const ahead = (a: Arrow): LatLng => ({
      latitude: a.at.latitude + (AHEAD_M * Math.cos(a.bearing * rad)) / 111_320,
      longitude: a.at.longitude + (AHEAD_M * Math.sin(a.bearing * rad)) / (111_320 * Math.cos(a.at.latitude * rad)),
    });
    try {
      const pts = await Promise.all(
        arrows.map(async (a) => {
          const [p, q] = await Promise.all([map.pointForCoordinate(a.at), map.pointForCoordinate(ahead(a))]);
          return { p, q };
        }),
      );
      if (id !== run.current) return;
      const { w, h } = sizeRef.current;
      const out: Array<{ x: number; y: number; deg: number }> = [];
      let last: { x: number; y: number } | null = null;
      for (const { p, q } of pts) {
        if (p.x < 0 || p.y < 0 || (w && p.x > w) || (h && p.y > h)) continue;
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < GAP_PX) continue;
        out.push({ x: p.x, y: p.y, deg: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI });
        last = p;
      }
      setShown(out);
      k.value = withTiming(1, { duration: 180, easing: SOFT, reduceMotion: ReduceMotion.Never });
    } catch {
      // mappa smontata nel frattempo
    }
  }, [arrows, mapRef, sizeRef, k]);

  useImperativeHandle(ref, () => ({ place: () => void place(), hide }), [place, hide]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {shown.map((a, i) => (
        <View key={i} style={[s.arrow, { left: a.x - SIZE / 2, top: a.y - SIZE / 2, transform: [{ rotate: `${a.deg}deg` }] }]}>
          <Ionicons name="chevron-forward" size={SIZE} color="rgba(255,255,255,0.92)" />
        </View>
      ))}
    </Animated.View>
  );
});

const s = StyleSheet.create({
  arrow: { position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
