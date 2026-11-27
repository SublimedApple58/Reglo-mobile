import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ClaySurface } from '../clay';
import { fadeIn } from '../../screens/firstAccess/FirstAccessStepScreen';
import { CLAY } from '../../theme/clay';
import type { StudentAvailabilityBand, StudentBandKey, StudentBandsByDay } from '../../types/regloApi';
import { WEEK, countText, mergedRanges, type DayKey } from '../../utils/studentAvailability';

const TRACK_H = 118;

/**
 * REG-802 — la settimana dell'allievo a colpo d'occhio: una colonna per giorno
 * (lun → dom) su una scala fissa dalla prima all'ultima fascia (8–21), con le
 * linee dove una fascia finisce e l'altra comincia. Due fasce attaccate sono
 * una barra sola, con un taglio bianco sottile al confine. È il protagonista
 * dello step Disponibilità; lo staff la vede uguale, in sola lettura.
 */
export const StudentWeekStrip = memo(function StudentWeekStrip({
  days,
  bands,
  title = 'La tua settimana',
  onPressDay,
  ghost,
  pressLabel,
  quietEmpty = false,
}: {
  days: StudentBandsByDay;
  bands: StudentAvailabilityBand[];
  title?: string;
  /** Tocco su una colonna (apre il giorno); assente = sola lettura. */
  onPressDay?: (day: DayKey) => void;
  /**
   * Onboarding guidato: le fasce che un tocco metterebbe, disegnate in
   * trasparenza nei giorni ancora vuoti (invitano a toccare).
   */
  ghost?: readonly StudentBandKey[];
  /** Etichetta accessibile della colonna (default «Lunedì, cambia fasce»). */
  pressLabel?: (day: string, on: boolean) => string;
  /** Senza giorni non scrive «Tocca un giorno per iniziare» (lo dice già chi la monta). */
  quietEmpty?: boolean;
}) {
  const from = bands[0]?.startMinutes ?? 8 * 60;
  const to = bands[bands.length - 1]?.endMinutes ?? 21 * 60;
  const span = Math.max(to - from, 60);
  const y = (m: number) => ((m - from) / span) * TRACK_H;
  const ticks = bands.slice(1).map((b) => b.startMinutes);
  const axis = [from, ...ticks, to];

  return (
    <ClaySurface style={s.card} padded={false}>
      <View style={s.head}>
        <Text style={s.title}>{title}</Text>
        {quietEmpty && !WEEK.some((d) => (days[d.key]?.length ?? 0) > 0) ? null : <Text style={s.count}>{countText(days)}</Text>}
      </View>
      <View style={s.strip}>
        <View style={[s.axis, { height: TRACK_H }]}>
          {axis.map((m) => (
            <Text key={m} style={[s.axisLabel, { top: y(m) - 7 }]}>
              {Math.round(m / 60)}
            </Text>
          ))}
        </View>
        {WEEK.map((d) => {
          const on = (days[d.key]?.length ?? 0) > 0;
          const segs = mergedRanges(days[d.key], bands);
          const col = (
            <>
              <Text style={[s.day, on && s.dayOn]}>{d.short}</Text>
              <View style={[s.track, { height: TRACK_H }]}>
                {ticks.map((m) => (
                  <View key={m} style={[s.tick, { top: y(m) }]} />
                ))}
                {!on && ghost?.length
                  ? mergedRanges(ghost, bands).map((seg) => (
                      <View
                        key={`g${seg.startMinutes}`}
                        style={[s.ghost, { top: y(seg.startMinutes) + 1, height: y(seg.endMinutes) - y(seg.startMinutes) - 2 }]}
                      />
                    ))
                  : null}
                {segs.map((seg) => (
                  <Animated.View
                    entering={fadeIn}
                    key={seg.startMinutes}
                    style={[s.seg, { top: y(seg.startMinutes) + 1, height: y(seg.endMinutes) - y(seg.startMinutes) - 2 }]}
                  >
                    {seg.cuts.map((c) => (
                      <View key={c} style={[s.cut, { top: y(c) - y(seg.startMinutes) - 1.75 }]} />
                    ))}
                  </Animated.View>
                ))}
              </View>
            </>
          );
          return onPressDay ? (
            <Pressable
              key={d.key}
              style={({ pressed }) => [s.col, pressed && s.pressed]}
              onPress={() => onPressDay(d.key)}
              accessibilityRole="button"
              accessibilityLabel={pressLabel ? pressLabel(d.full, on) : `${d.full}, cambia fasce`}
            >
              {col}
            </Pressable>
          ) : (
            <View key={d.key} style={s.col}>
              {col}
            </View>
          );
        })}
      </View>
    </ClaySurface>
  );
});

const s = StyleSheet.create({
  card: { borderRadius: 28, paddingTop: 16, paddingBottom: 16, paddingLeft: 10, paddingRight: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingLeft: 10, paddingRight: 4 },
  title: { fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  count: { fontSize: 13.5, fontWeight: '500', color: CLAY.ink3 },
  strip: { flexDirection: 'row', marginTop: 12 },
  axis: { width: 24, marginTop: 23 },
  axisLabel: {
    position: 'absolute',
    right: 5,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
    color: CLAY.ink4,
    fontVariant: ['tabular-nums'],
  },
  col: { flex: 1, alignItems: 'center' },
  pressed: { opacity: 0.6 },
  day: { fontSize: 12.5, lineHeight: 15, fontWeight: '500', color: CLAY.ink3 },
  dayOn: { color: CLAY.ink, fontWeight: '600' },
  track: { marginTop: 8, width: 30, borderRadius: 11, backgroundColor: 'rgba(17,17,17,0.045)', overflow: 'hidden' },
  tick: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(17,17,17,0.07)' },
  // Fasce «in trasparenza» dei giorni vuoti (onboarding guidato).
  ghost: { position: 'absolute', left: 0, right: 0, borderRadius: 8, backgroundColor: 'rgba(17,17,17,0.10)' },
  seg: { position: 'absolute', left: 0, right: 0, borderRadius: 8, backgroundColor: CLAY.ink },
  cut: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.42)' },
});
