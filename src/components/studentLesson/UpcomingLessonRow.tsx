import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, CLAY_ROW_PRESSED, Icon3D } from '../clay';
import { car34Art } from '../../road/markerArt';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { monthShort, timeRangeWords, weekdayWord } from '../../utils/studentLessons';
import { firstName } from './LessonSheetParts';
import type { AutoscuolaAppointmentWithRelations } from '../../types/regloApi';

const ART = {
  orologio: require('../../../assets/vita/orologio.png'),
  persone: require('../../../assets/icons3d-ai/persone.png'),
};

/**
 * REG-791 — una guida IN PROGRAMMA a riga (anteprime H1/P1, Tiziano
 * 25/11/2026): data in tessera clay in rilievo (le future si riconoscono da
 * qui; le fatte hanno la data piatta), giorno e orario, istruttore con
 * l'avatar, a destra il 3D: l'auto nel colore del veicolo, le pedine per un
 * posto di gruppo, l'orologio se l'allievo l'ha lasciata a un compagno.
 * Usata dalla home («Prossime guide») e da «In programma».
 */
export const UpcomingLessonRow = memo(function UpcomingLessonRow({
  lesson,
  swapAsked,
  first,
  chevron,
  onPress,
}: {
  lesson: AutoscuolaAppointmentWithRelations;
  /** L'allievo l'ha lasciata a un compagno (richiesta di scambio aperta). */
  swapAsked: boolean;
  first?: boolean;
  /** In «In programma» la riga è una voce di lista: chevron. In home no (anteprima H1). */
  chevron?: boolean;
  onPress: (lesson: AutoscuolaAppointmentWithRelations) => void;
}) {
  const group = !!lesson.groupLessonId;
  const instructor = lesson.instructor?.name ?? null;
  const who = group
    ? ['Guida di gruppo', instructor].filter(Boolean).join(' · ')
    : [firstName(instructor) ?? 'Istruttore da assegnare', lesson.vehicle?.name].filter(Boolean).join(' · ');
  const art = swapAsked ? (
    <Icon3D source={ART.orologio} size={34} />
  ) : group ? (
    <Icon3D source={ART.persone} size={36} />
  ) : lesson.vehicle ? (
    <Icon3D source={car34Art(lesson.vehicle.color)} size={32} width={40} />
  ) : null;
  const day = new Date(lesson.startsAt).getDate();

  return (
    <Pressable
      onPress={() => onPress(lesson)}
      style={({ pressed }) => [s.row, pressed && CLAY_ROW_PRESSED]}
      accessibilityRole="button"
      accessibilityLabel={`${weekdayWord(lesson.startsAt)} ${day} ${monthShort(lesson.startsAt)}, ${timeRangeWords(lesson)}, ${swapAsked ? 'in attesa di un compagno' : who}`}
      testID={`upcoming-${lesson.id}`}
    >
      <View style={s.tile}>
        <Text style={s.tileDay}>{day}</Text>
        <Text style={s.tileMonth}>{monthShort(lesson.startsAt)}</Text>
      </View>
      <View style={[s.body, !first && s.divider]}>
        <View style={s.text}>
          <Text style={s.title} numberOfLines={1}>
            {weekdayWord(lesson.startsAt)} · {timeRangeWords(lesson)}
          </Text>
          {swapAsked ? (
            <Text style={[s.sub, s.subWait]} numberOfLines={1}>
              In attesa di un compagno
            </Text>
          ) : (
            <View style={s.who}>
              {!group && instructor ? (
                <Avatar userId={lesson.instructor?.userId ?? lesson.instructor?.id} name={instructor} size={20} />
              ) : null}
              <Text style={s.sub} numberOfLines={1}>
                {who}
              </Text>
            </View>
          )}
        </View>
        {art}
        {chevron ? <Ionicons name="chevron-forward" size={17} color={CLAY.ink3} /> : null}
      </View>
    </Pressable>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 74, gap: 12 },
  tile: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...CLAY_SHADOW.raiseSm,
  },
  tileDay: { fontSize: 20, lineHeight: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  tileMonth: { fontSize: 11.5, color: CLAY.ink3 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', paddingVertical: 12 },
  divider: { borderTopWidth: 0.5, borderTopColor: 'rgba(17,17,17,0.12)' },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  sub: { flexShrink: 1, fontSize: 14, color: CLAY.ink3 },
  subWait: { color: CLAY.ink2, marginTop: 3 },
});
