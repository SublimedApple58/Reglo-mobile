import React, { useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow } from '../../../src/components/clay';
import { ownerTodayInstructorStore } from '../../../src/stores/ownerTodayInstructorStore';
import { firstNameOf, hhmm, windowsText, type TodayItem } from '../../../src/components/ownerToday/todayModel';
import { CLAY } from '../../../src/theme/clay';

/** Righe mostrate prima di «Altre N». */
const FIRST_ROWS = 5;

/**
 * Foglio istruttore di «Oggi» (REG-794, anteprima O2): la sua giornata a righe
 * (fatte in grigio, quella in corso in nero), poi Chiama, Disponibilità e
 * Assenze (con la prossima: «Ferie dal 22 dic»), che aprono «Disponibilità di …»
 * (REG-794); per sé stessi «Segna malattia». In fondo «Vedi la settimana di …».
 */
export default function OwnerTodayInstructorSheet() {
  const data = useSyncExternalStore(ownerTodayInstructorStore.subscribe, ownerTodayInstructorStore.get);
  const [expanded, setExpanded] = useState(false);
  if (!data) return <View style={s.blank} />;

  const { day, phone, isMe } = data;
  const now = new Date();
  const rows = expanded ? day.items : day.items.slice(0, FIRST_ROWS);
  const hidden = day.items.length - rows.length;
  const first = firstNameOf(day.instructor.name);

  return (
    <FormSheet
      title={day.instructor.name}
      subtitle={day.sheetLine}
      testID="today-instructor-sheet"
      cta={
        <ClayButton
          title={isMe ? 'Vedi la tua settimana' : `Vedi la settimana di ${first}`}
          onPress={data.onWeek}
          testID="today-instructor-week"
        />
      }
    >
      <View style={s.dayHead}>
        <Text style={s.dayTitle}>{isMe ? 'La tua giornata' : 'La sua giornata'}</Text>
        <Text style={s.dayCount}>
          {day.lessonCount ? `${day.lessonCount} guid${day.lessonCount === 1 ? 'a' : 'e'}` : 'Nessuna guida'}
        </Text>
      </View>
      {rows.map((item) => (
        <DayRow key={item.key} item={item} now={now} />
      ))}
      {hidden > 0 ? (
        <Pressable onPress={() => setExpanded(true)} style={s.more} accessibilityRole="button" testID="today-instructor-more">
          <Text style={s.moreTx}>Altre {hidden}</Text>
          <Ionicons name="chevron-down" size={15} color={CLAY.ink3} />
        </Pressable>
      ) : null}

      <ClayList style={s.actions}>
        {phone ? (
          <ClayListRow
            key="call"
            title="Chiama"
            trailing={<Text style={s.trailing}>{phone}</Text>}
            chevron={false}
            onPress={() => { void Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`); }}
            testID="today-instructor-call"
          />
        ) : null}
        <ClayListRow
          key="availability"
          title="Disponibilità"
          trailing={<Text style={s.trailing} numberOfLines={1}>{day.windows.length ? windowsText(day.windows) : 'Nessuna oggi'}</Text>}
          onPress={data.onAvailability}
          testID="today-instructor-availability"
        />
        {isMe ? (
          <ClayListRow
            key="sick"
            title="Segna malattia"
            onPress={data.onSick}
            testID="today-instructor-sick"
          />
        ) : (
          <ClayListRow
            key="absences"
            title="Assenze"
            trailing={data.absenceLine ? <Text style={s.trailing} numberOfLines={1}>{data.absenceLine}</Text> : undefined}
            onPress={data.onAbsences}
            testID="today-instructor-absences"
          />
        )}
      </ClayList>
    </FormSheet>
  );
}

const DayRow = React.memo(function DayRow({ item, now }: { item: TodayItem; now: Date }) {
  const done = item.end <= now;
  const live = item.start <= now && now < item.end;
  const state = item.absent ? 'Assente' : live ? 'In corso' : done ? 'Fatta' : '';
  return (
    <View style={s.row}>
      <Text style={[s.time, done && s.dim]}>{hhmm(item.start)}</Text>
      <Text style={[s.label, done && s.dim]} numberOfLines={1}>{item.label}</Text>
      {state ? <Text style={[s.state, live && s.stateLive, item.absent && s.stateAbsent]}>{state}</Text> : null}
    </View>
  );
});

const s = StyleSheet.create({
  blank: { flex: 1, backgroundColor: '#FFFFFF' },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(17,17,17,0.12)',
  },
  dayTitle: { fontSize: 18, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  dayCount: { fontSize: 15, color: CLAY.ink3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(17,17,17,0.12)',
  },
  time: { width: 52, fontSize: 16, fontWeight: '500', color: CLAY.ink, fontVariant: ['tabular-nums'] },
  label: { flex: 1, fontSize: 16, color: CLAY.ink, letterSpacing: -0.2 },
  dim: { color: CLAY.ink3 },
  state: { fontSize: 14, color: CLAY.ink3 },
  stateLive: { color: CLAY.ink, fontWeight: '600' },
  stateAbsent: { color: '#C13515' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingLeft: 70 },
  moreTx: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  actions: { marginTop: 18 },
  trailing: { fontSize: 15, color: CLAY.ink3, maxWidth: 170, fontVariant: ['tabular-nums'] },
});
