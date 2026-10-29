import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarRating } from '../StarRating';
import { RoadHistoryChip } from '../road/RoadLessonCard';
import { CLAY } from '../../theme/clay';
import { formatDay, formatTime } from '../../utils/date';
import { EXAM_TIME_TBD, examTimeIsTbd } from '../../utils/examTime';
import { evaluationSummary, evaluationSummaryLabel } from '../../utils/evaluationSheet';
import { asMotoLessonType, MOTO_LESSON_TYPE_LABELS } from '../../utils/motoLessonType';
import {
  asExamOutcome,
  canRecordExamOutcome,
  EXAM_OUTCOME_LABELS,
  EXAM_OUTCOME_TONE,
} from '../../utils/examOutcome';
import type { AutoscuolaAppointmentWithRelations, RoadStudentItem } from '../../types/regloApi';

const OPEN_IN = FadeIn.duration(180).reduceMotion(ReduceMotion.Never);
const OPEN_OUT = FadeOut.duration(120).reduceMotion(ReduceMotion.Never);

/**
 * Una guida dello storico allievo: data, istruttore · veicolo · tipo, esito
 * esame, pagellino apribile, percorso Road, note con la matita.
 *
 * In `memo` e con il pagellino aperto/chiuso nello stato della riga (§15):
 * aprirne uno ridisegna solo questa riga, e niente transizioni di layout —
 * le voci compaiono in dissolvenza. La stessa riga serve la scheda (ultime 5,
 * dentro una card) e il foglio «Tutte le guide» (righe piatte, FlatList).
 */
export const LessonHistoryRow = React.memo(function LessonHistoryRow({
  appt,
  divider,
  roadItem,
  saving,
  onDetails,
  onOutcome,
  onRoad,
}: {
  appt: AutoscuolaAppointmentWithRelations;
  divider: boolean;
  roadItem?: RoadStudentItem;
  saving: boolean;
  onDetails: (appt: AutoscuolaAppointmentWithRelations) => void;
  onOutcome: (appt: AutoscuolaAppointmentWithRelations) => void;
  onRoad: (appointmentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const typeLc = (appt.type ?? '').trim().toLowerCase();
  const isExam = typeLc === 'esame';
  const isGroup = typeLc === 'group_lesson' || !!appt.groupLessonId;
  const isMotoGroup = appt.groupLessonKind === 'moto';
  const motoType = asMotoLessonType(appt.motoLessonType);
  const allTypes = (appt.types?.length ? appt.types : (appt.type ? [appt.type] : []))
    .filter((t: string) => t !== 'guida' && t !== 'group_lesson' && t.toLowerCase() !== 'esame')
    .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));
  const kind = isExam
    ? 'Esame'
    : isGroup
      ? `${isMotoGroup ? 'Gruppo moto' : 'Guida di gruppo'}${appt.groupLessonCapacity ? ` · ${appt.groupLessonFilled ?? 0}/${appt.groupLessonCapacity}` : ''}`
      : [...allTypes, motoType ? MOTO_LESSON_TYPE_LABELS[motoType] : null].filter(Boolean).join(' · ');
  const vehicles = [appt.vehicle?.name, ...(appt.extraMotoVehicles ?? []).map((v) => v.name), appt.followVehicle?.name]
    .filter(Boolean)
    .join(' + ');
  const meta = isExam ? kind : [appt.instructor?.name ?? 'Istruttore', vehicles || null, kind || null].filter(Boolean).join(' · ');
  const summary = evaluationSummary(appt.evaluations);
  const outcome = isExam ? asExamOutcome(appt.examOutcome) : null;
  const recordable = isExam && canRecordExamOutcome(appt);
  const oldStars = appt.rating != null && !appt.evaluations?.length;
  const note = appt.notes?.trim();

  return (
    <View style={[s.row, divider && s.divider]}>
      <View style={s.rowBetween}>
        <Text style={s.date}>
          {formatDay(appt.startsAt)} · {examTimeIsTbd(appt) ? EXAM_TIME_TBD : formatTime(appt.startsAt)}
        </Text>
        {oldStars ? <StarRating value={appt.rating as number} readOnly size={13} tone="gold" /> : null}
      </View>
      <Text style={s.meta} numberOfLines={2}>{meta}</Text>

      {isExam && (outcome || recordable) ? (
        <Pressable
          onPress={recordable && !saving ? () => onOutcome(appt) : undefined}
          disabled={!recordable || saving}
          hitSlop={6}
          accessibilityRole={recordable ? 'button' : 'text'}
          style={({ pressed }) => [s.inlineAction, (pressed || saving) && { opacity: 0.6 }]}
        >
          <Text
            style={[
              s.inlineActionTx,
              outcome ? { color: EXAM_OUTCOME_TONE[outcome].ink, textDecorationLine: 'none' } : null,
            ]}
          >
            {outcome ? `Esito: ${EXAM_OUTCOME_LABELS[outcome]}` : 'Registra esito'}
          </Text>
        </Pressable>
      ) : null}

      {summary ? (
        <View>
          <Pressable
            onPress={() => setOpen((v) => !v)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={({ pressed }) => [s.evalRow, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="star" size={12} color="#F5A524" />
            <Text style={s.evalTx}>{evaluationSummaryLabel(summary)}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={CLAY.ink4} />
          </Pressable>
          {open ? (
            <Animated.View entering={OPEN_IN} exiting={OPEN_OUT} style={s.voci}>
              {(appt.evaluations ?? [])
                .filter((r) => r.notApplicable || r.score != null)
                .map((r, i) => (
                  <View key={r.itemId} style={[s.voce, i > 0 && s.divider]}>
                    <Text style={s.voceName} numberOfLines={2}>{r.label}</Text>
                    {r.notApplicable || r.score == null ? (
                      <Text style={s.voceNa}>non valutabile</Text>
                    ) : (
                      <StarRating value={r.score} total={r.scaleMax} readOnly size={13} tone="gold" />
                    )}
                  </View>
                ))}
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {roadItem ? <RoadHistoryChip item={roadItem} onPress={() => onRoad(appt.id)} /> : null}

      <Pressable
        onPress={() => onDetails(appt)}
        accessibilityRole="button"
        accessibilityLabel={note ? 'Modifica dettagli' : 'Aggiungi dettagli'}
        hitSlop={10}
        style={({ pressed }) => [
          s.noteRow,
          // Senza note la matita sale accanto alla data (se lì non c'è già la
          // vecchia stellina).
          !note && !oldStars && s.noteRowEmpty,
          pressed && { opacity: 0.6 },
        ]}
      >
        {note ? <Text style={s.note}>{note}</Text> : <View style={{ flex: 1 }} />}
        <Ionicons name="create-outline" size={15} color={CLAY.ink4} />
      </Pressable>
    </View>
  );
});

const s = StyleSheet.create({
  row: { paddingVertical: 14, paddingHorizontal: 18 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(17,17,17,0.12)' },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  date: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  meta: { fontSize: 14, color: CLAY.ink3, marginTop: 3 },
  inlineAction: { alignSelf: 'flex-start', marginTop: 8 },
  inlineActionTx: { fontSize: 14.5, fontWeight: '600', color: CLAY.ink, textDecorationLine: 'underline' },
  evalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8 },
  evalTx: { fontSize: 14, fontWeight: '500', color: CLAY.ink2 },
  voci: { marginTop: 6 },
  voce: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8 },
  voceName: { flex: 1, fontSize: 14, color: CLAY.ink },
  voceNa: { fontSize: 13, color: CLAY.ink4 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  note: { flex: 1, fontSize: 15, color: CLAY.ink, lineHeight: 20 },
  noteRowEmpty: { position: 'absolute', top: 16, right: 18, marginTop: 0 },
});
