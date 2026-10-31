import React from 'react';
import { ExpandableText } from './ExpandableText';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { Router } from 'expo-router';
import { ClayButton, ClaySurface } from '../clay';
import { CLAY } from '../../theme';
import { ROAD_TEXT_IN } from '../../road/motion';
import { openRoadNotes, useRoadNotes, type RoadNotesRoute } from '../../road/roadNotes';
import type { RoadLesson } from '../../types/regloApi';

/**
 * Giro Road (Tiziano 28/10): riga «Note sulla guida» a fine guida (riepilogo
 * di Road, «Appena finita»), sotto il pagellino e con la sua stessa forma.
 * Mostra l'inizio della nota; «Scrivi» / «Modifica» apre il foglio note.
 */
export function RoadNotesCard({
  router,
  lesson,
  route,
  style,
}: {
  router: Router;
  lesson: RoadLesson;
  route: RoadNotesRoute;
  style?: object;
}) {
  const note = useRoadNotes(lesson);
  const has = !!note;
  return (
    <ClaySurface radius={24} style={[s.card, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title}>Note sulla guida</Text>
        {has ? (
          // Nota lunga: toccandola si legge tutta (Tiziano 31/10).
          <Animated.View key={note} entering={ROAD_TEXT_IN}>
            <ExpandableText text={note} numberOfLines={2} style={[s.sub, s.subNote]} testID="road-notes-text" />
          </Animated.View>
        ) : (
          <Animated.Text key={note ?? '-'} entering={ROAD_TEXT_IN} style={s.sub} numberOfLines={2}>
            {note === undefined ? ' ' : 'Cosa ricordare di questa guida'}
          </Animated.Text>
        )}
      </View>
      <ClayButton
        compact
        variant="secondary"
        title={has ? 'Modifica' : 'Scrivi'}
        onPress={() => void openRoadNotes(router, lesson, route)}
        style={s.btn}
        testID="road-notes-card"
      />
    </ClaySurface>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingLeft: 18, paddingRight: 12 },
  title: { fontSize: 15.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  sub: { fontSize: 13, fontWeight: '400', color: CLAY.ink3, marginTop: 2 },
  subNote: { color: CLAY.ink2 },
  btn: { alignSelf: 'center', paddingHorizontal: 18, height: 40, borderRadius: 20 },
});
