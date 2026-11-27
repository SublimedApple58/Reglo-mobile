import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { CLAY, CLAY_SHADOW } from '../../theme';
import { NIGHT } from '../../road/night';
import { formatKm, formatMinutes } from '../../road/format';

/**
 * REG-753 «Cruscotto» — nelle guide moto prende il posto del cerchio della
 * velocità (che lì sarebbe la velocità dell'auto al seguito, non della moto).
 * Quadrante da strumentazione: arco di 270° aperto in basso che si riempie col
 * tempo di guida, al centro i minuti, nell'apertura i km. Stessa superficie e
 * ombra del cerchio della velocità; bianco/nero, notte compresa.
 * L'arco avanza sul thread UI in 280 ms senza rimbalzo; «Riduci movimento» non
 * spegne niente (regola Road).
 */

export const MOTO_DIAL = 84;
const STROKE = 4;
const R = (MOTO_DIAL - 14) / 2;
const C = 2 * Math.PI * R;
/** L'arco copre 270°: il resto (in basso) è l'apertura dove stanno i km. */
const SWEEP = 0.75;
const ARC = C * SWEEP;
const TICKS = 7;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function useNow(everyMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export const RoadMotoDial = React.memo(function RoadMotoDial({
  startedAt,
  driveEnd,
  distanceMeters,
  night,
  style,
}: {
  /** Inizio della sessione Road (ISO). */
  startedAt: string;
  /** Fine che vale mentre si guida (`lessonDriveEnd`), ISO. */
  driveEnd: string | null;
  distanceMeters: number;
  night: boolean;
  style?: ViewStyle;
}) {
  const now = useNow(5_000);
  const start = new Date(startedAt).getTime();
  const end = driveEnd ? new Date(driveEnd).getTime() : null;
  const elapsedSec = Math.max(0, (now - start) / 1000);
  const total = end != null ? end - start : 0;
  const progress = total > 0 ? Math.min(1, Math.max(0, (now - start) / total)) : 0;

  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = withTiming(progress, { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }, [p, progress]);
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: ARC * (1 - p.value) }));

  const ink = night ? NIGHT.ink : CLAY.ink;
  const ink3 = night ? NIGHT.ink3 : CLAY.ink3;
  const track = night ? 'rgba(255,255,255,0.12)' : 'rgba(17,17,17,0.08)';
  const tick = night ? 'rgba(255,255,255,0.28)' : 'rgba(17,17,17,0.22)';
  const minutes = formatMinutes(elapsedSec);
  const km = formatKm(distanceMeters);
  const mid = MOTO_DIAL / 2;

  return (
    <View
      style={[s.dial, { backgroundColor: night ? NIGHT.surface : CLAY.surface }, CLAY_SHADOW.raise, style]}
      accessibilityLabel={`In guida da ${minutes} minuti, ${km} chilometri`}
      testID="road-moto-dial"
    >
      <Svg width={MOTO_DIAL} height={MOTO_DIAL} style={StyleSheet.absoluteFill}>
        {/* Tacche della scala, appena dentro l'arco (da 135° a 405°). */}
        {Array.from({ length: TICKS }, (_, i) => {
          const a = ((135 + (270 * i) / (TICKS - 1)) * Math.PI) / 180;
          const r1 = R - 7;
          const r2 = R - 4;
          return (
            <Line
              key={i}
              x1={mid + r1 * Math.cos(a)}
              y1={mid + r1 * Math.sin(a)}
              x2={mid + r2 * Math.cos(a)}
              y2={mid + r2 * Math.sin(a)}
              stroke={tick}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}
        <Circle
          cx={mid}
          cy={mid}
          r={R}
          stroke={track}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${C}`}
          transform={`rotate(135 ${mid} ${mid})`}
        />
        <AnimatedCircle
          cx={mid}
          cy={mid}
          r={R}
          stroke={ink}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${C}`}
          animatedProps={arcProps}
          transform={`rotate(135 ${mid} ${mid})`}
        />
      </Svg>
      <Text style={[s.num, { color: ink }]}>{minutes}</Text>
      <Text style={[s.unit, { color: ink3 }]}>min</Text>
      <Text style={[s.km, { color: ink }]} numberOfLines={1}>
        {km}
        <Text style={{ color: ink3 }}> km</Text>
      </Text>
    </View>
  );
});

const s = StyleSheet.create({
  dial: {
    width: MOTO_DIAL,
    height: MOTO_DIAL,
    borderRadius: MOTO_DIAL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontSize: 24, fontWeight: '600', letterSpacing: -0.7, lineHeight: 26, fontVariant: ['tabular-nums'], marginTop: -4 },
  unit: { fontSize: 10.5, fontWeight: '500', marginTop: -1 },
  km: {
    position: 'absolute',
    bottom: 7,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },
});
