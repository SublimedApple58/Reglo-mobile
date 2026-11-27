import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { ClaySurface } from "../clay";
import { fadeIn } from "../../screens/firstAccess/FirstAccessStepScreen";
import { CLAY } from "../../theme/clay";
import type {
  StudentAvailabilityBand,
  StudentRangesByDay,
} from "../../types/regloApi";
import {
  WEEK,
  countText,
  daySegments,
  weekScale,
  type DayKey,
} from "../../utils/studentAvailability";

const TRACK_FULL = 118;

/**
 * REG-802 — la settimana dell'allievo a colpo d'occhio: una colonna per giorno
 * (lun → dom) su una scala dalla prima all'ultima fascia (8–21), con le linee
 * dove una fascia finisce e l'altra comincia. Due fasce attaccate sono una
 * barra sola, con un taglio bianco sottile al confine; «un orario preciso»
 * (REG-813) è una barra lunga quanto le sue ore. È il protagonista
 * dello step Disponibilità; lo staff la vede uguale, in sola lettura.
 */
export const StudentWeekStrip = memo(function StudentWeekStrip({
  days,
  bands,
  title = "La tua settimana",
  onPressDay,
  current,
  compact = false,
  pressLabel,
}: {
  days: StudentRangesByDay;
  bands: StudentAvailabilityBand[];
  title?: string;
  /** Tocco su una colonna (apre il giorno); assente = sola lettura. */
  onPressDay?: (day: DayKey) => void;
  /** Scelta guidata: il giorno della domanda in corso (colonna cerchiata). */
  current?: DayKey | null;
  /** Scelta guidata: settimana bassa, senza testata né ore, che fa da avanzamento. */
  compact?: boolean;
  /** Etichetta accessibile della colonna (default «Lunedì, cambia fasce»). */
  pressLabel?: (day: string) => string;
}) {
  const TRACK_H = compact ? 44 : TRACK_FULL;
  // REG-813: la scala è quella delle fasce (8–21) e si allarga solo se un
  // orario preciso esce (fino a 6–22).
  const { from, to } = weekScale(days, bands);
  const span = Math.max(to - from, 60);
  const y = (m: number) => ((m - from) / span) * TRACK_H;
  const ticks = bands.slice(1).map((b) => b.startMinutes);
  const axis = [from, ...ticks, to];
  const hasDays = WEEK.some((d) => (days[d.key]?.length ?? 0) > 0);

  return (
    <Wrap compact={compact}>
      {compact ? null : (
        <View style={s.head}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          {/* L'invito «Tocca un giorno…» ha senso solo dove i giorni si toccano:
              in sola lettura (foglio dello staff) con zero giorni non c'è nulla. */}
          {hasDays || onPressDay ? (
            <Text style={s.count} numberOfLines={1}>
              {countText(days)}
            </Text>
          ) : null}
        </View>
      )}
      <View style={[s.strip, compact && s.stripCompact]}>
        {compact ? null : (
          <View style={[s.axis, { height: TRACK_H }]}>
            {axis.map((m) => (
              <Text key={m} style={[s.axisLabel, { top: y(m) - 7 }]}>
                {Math.round(m / 60)}
              </Text>
            ))}
          </View>
        )}
        {WEEK.map((d) => {
          const on = (days[d.key]?.length ?? 0) > 0;
          const segs = daySegments(days[d.key], bands);
          const col = (
            <>
              <Text style={[s.day, (on || d.key === current) && s.dayOn]}>
                {d.short}
              </Text>
              <View
                style={[
                  s.track,
                  { height: TRACK_H },
                  d.key === current && s.trackCurrent,
                ]}
              >
                {ticks.map((m) => (
                  <View key={m} style={[s.tick, { top: y(m) }]} />
                ))}
                {segs.map((seg) => (
                  <Animated.View
                    entering={fadeIn}
                    key={seg.startMinutes}
                    style={[
                      s.seg,
                      {
                        top: y(seg.startMinutes) + 1,
                        height: y(seg.endMinutes) - y(seg.startMinutes) - 2,
                      },
                    ]}
                  >
                    {seg.cuts.map((c) => (
                      <View
                        key={c}
                        style={[
                          s.cut,
                          { top: y(c) - y(seg.startMinutes) - 1.75 },
                        ]}
                      />
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
              accessibilityLabel={
                pressLabel ? pressLabel(d.full) : `${d.full}, cambia fasce`
              }
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
    </Wrap>
  );
});

/** Compatta = nuda sulla pagina (fa da avanzamento); intera = scheda clay. */
const Wrap = ({
  compact,
  children,
}: {
  compact: boolean;
  children: React.ReactNode;
}) =>
  compact ? (
    <View>{children}</View>
  ) : (
    <ClaySurface style={s.card} padded={false}>
      {children}
    </ClaySurface>
  );

const s = StyleSheet.create({
  card: {
    borderRadius: 28,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 10,
    paddingRight: 16,
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingLeft: 10,
    paddingRight: 4,
    gap: 12,
  },
  // Il titolo cede spazio (ellissi), il testo a destra resta intero e dentro la scheda.
  title: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
    color: CLAY.ink,
    letterSpacing: -0.2,
  },
  count: {
    flexShrink: 0,
    maxWidth: "70%",
    fontSize: 13.5,
    fontWeight: "500",
    color: CLAY.ink3,
    textAlign: "right",
  },
  strip: { flexDirection: "row", marginTop: 12 },
  stripCompact: { marginTop: 0 },
  axis: { width: 24, marginTop: 23 },
  axisLabel: {
    position: "absolute",
    right: 5,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "500",
    color: CLAY.ink4,
    fontVariant: ["tabular-nums"],
  },
  col: { flex: 1, alignItems: "center" },
  pressed: { opacity: 0.6 },
  day: { fontSize: 12.5, lineHeight: 15, fontWeight: "500", color: CLAY.ink3 },
  dayOn: { color: CLAY.ink, fontWeight: "600" },
  track: {
    marginTop: 8,
    width: 30,
    borderRadius: 11,
    backgroundColor: "rgba(17,17,17,0.045)",
    overflow: "hidden",
  },
  tick: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(17,17,17,0.07)",
  },
  // Giorno della domanda in corso (scelta guidata): colonna cerchiata.
  trackCurrent: { borderWidth: 1.5, borderColor: CLAY.ink },
  seg: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 8,
    backgroundColor: CLAY.ink,
  },
  cut: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
});
