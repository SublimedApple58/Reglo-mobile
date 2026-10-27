import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import { lessonDetailsStore } from '../stores/lessonDetailsStore';
import { regloApi } from '../services/regloApi';
import type { AutoscuolaAppointmentWithRelations, RoadLesson } from '../types/regloApi';
import { dayLabel, formatRange } from './format';
import { lessonStudentName } from './roadStore';

/**
 * REG-638 — apre il pagellino della guida sopra Road riusando il foglio della
 * home (`manage-lesson-details`, variante `road`): caricamento voci/punteggi e
 * logica di salvataggio restano quelli. Qui si salva SOLO il pagellino.
 */
export function openRoadPagellino(
  router: Router,
  lesson: RoadLesson,
  opts: { showStayChip: boolean; onSaved?: () => void },
) {
  // Il foglio legge id/tipo/stato; tipo/note/esito sono nascosti in Road.
  const appt = {
    id: lesson.appointmentId,
    startsAt: lesson.startsAt,
    endsAt: lesson.endsAt,
    status: lesson.status,
    type: 'guida',
    types: [],
    notes: null,
    groupLessonId: null,
    student: null,
    vehicle: null,
  } as unknown as AutoscuolaAppointmentWithRelations;

  const day = dayLabel(lesson.startsAt).toLowerCase();
  lessonDetailsStore.set({
    lesson: appt,
    isDetailsEditable: true,
    road: {
      subtitle: `${lessonStudentName(lesson)} · ${day} ${formatRange(lesson.startsAt, lesson.endsAt)}`,
      showStayChip: opts.showStayChip,
    },
    onSaveDetails: async ({ evaluations }) => {
      if (evaluations === undefined) return true; // niente di cambiato
      try {
        await regloApi.updateAppointmentDetails(lesson.appointmentId, { evaluations });
        opts.onSaved?.();
        return true;
      } catch (err) {
        Alert.alert('Pagellino non salvato', err instanceof Error ? err.message : 'Riprova tra poco.');
        return false;
      }
    },
  });
  router.push('/road/pagellino');
}
