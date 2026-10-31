import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';

import { CLAY, CLAY_SHADOW } from '../../theme';
import { ClayButton } from '../clay';
import { Icon3D } from '../clay/Icon3D';
import { ROAD_ASSETS } from '../../road/markerArt';
import { ROAD_FADE_IN, ROAD_FADE_OUT } from '../../road/motion';
import { formatMinutes } from '../../road/format';
import { lessonStudentName, useRoadSelector } from '../../road/roadStore';
import { returnToRoad, useRoadMinimized } from '../../road/miniStore';

/** Minuti della guida: bastano 15 s (come il pannello di Road). */
const TICK_MS = 15_000;

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/**
 * REG-700 Road ridotta — la barra sopra le voci della tab bar (come il
 * mini-player di Musica): «Guida con <Nome> · N min» e «Torna in Road».
 * Tutta la barra si tocca. Compare e sparisce in dissolvenza; la tab bar la
 * misura, quindi le schermate si tengono lo spazio da sole.
 */
export const RoadMiniBar = React.memo(function RoadMiniBar() {
  const minimized = useRoadMinimized();
  const phase = useRoadSelector((s) => s.phase);
  const session = useRoadSelector((s) => s.session);
  if (!minimized || phase !== 'active' || !session) return null;
  return <Bar startedAt={session.startedAt} name={lessonStudentName(session.lesson)} />;
});

function Bar({ startedAt, name }: { startedAt: string; name: string }) {
  const now = useNow(TICK_MS);
  const elapsedSec = Math.max(0, (now - new Date(startedAt).getTime()) / 1000);
  const first = name.trim().split(/\s+/)[0] || name;
  const back = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    returnToRoad();
  };
  return (
    <Animated.View entering={ROAD_FADE_IN} exiting={ROAD_FADE_OUT} style={st.wrap}>
      <Pressable
        onPress={back}
        style={({ pressed }) => [st.card, CLAY_SHADOW.raiseSm, pressed && st.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Guida con ${first} in corso da ${formatMinutes(elapsedSec)} minuti. Torna in Road`}
        testID="road-mini-bar"
      >
        <Icon3D source={ROAD_ASSETS.road} size={34} />
        <View style={st.text}>
          <Text style={st.title} numberOfLines={1}>
            Guida con {first}
          </Text>
          <Text style={st.meta} numberOfLines={1}>
            {formatMinutes(elapsedSec)} min
          </Text>
        </View>
        <ClayButton title="Torna in Road" compact onPress={back} testID="road-mini-back" />
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingBottom: 7 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: CLAY.surface,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  meta: { fontSize: 13, color: CLAY.ink3, marginTop: 1, fontVariant: ['tabular-nums'] },
});
