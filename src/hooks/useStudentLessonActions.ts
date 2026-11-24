import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { regloApi } from '../services/regloApi';
import { notificationEvents } from '../services/notificationEvents';
import { useCancelAppointment } from './mutations/useCancelAppointment';
import { lessonDetailStore } from '../stores/lessonDetailStore';
import { groupLessonStudentStore } from '../stores/groupLessonStudentStore';
import type { AutoscuolaAppointmentWithRelations, AutoscuolaSettings } from '../types/regloApi';

type Notice = (text: string, tone: 'success' | 'info' | 'danger') => void;

/**
 * REG-786 — apre una guida in arrivo dalla tab Guide, con le stesse azioni
 * della home (cerca sostituto, revoca, annulla) e le stesse regole: niente
 * scambio su gruppi ed esami, avviso penale entro il preavviso, nessun
 * aggiornamento ottimistico (si aspetta il BE, poi si ricaricano i dati).
 * Il foglio è `lesson-detail` dello stack in cui si apre (`stack`).
 */
export function useStudentLessonActions({
  stack,
  studentId,
  settings,
  swapEnabled,
  canCancel,
  mySwapByAppointment,
  notice,
}: {
  stack: 'guide' | 'home';
  studentId: string | null;
  settings: AutoscuolaSettings | null;
  swapEnabled: boolean;
  canCancel: boolean;
  mySwapByAppointment: Map<string, string>;
  notice: Notice;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cancelMutation = useCancelAppointment();

  const refreshSwaps = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['swap-my-offers'] }),
      queryClient.invalidateQueries({ queryKey: ['swap-offers'] }),
    ]);
    notificationEvents.emitDataChanged();
  }, [queryClient]);

  const createSwap = useCallback(
    async (appointmentId: string) => {
      try {
        await regloApi.createSwapOffer(appointmentId);
        await refreshSwaps();
        notice('Richiesta di sostituzione inviata!', 'success');
      } catch (err) {
        notice(err instanceof Error ? err.message : 'Errore durante la richiesta di scambio', 'danger');
      }
    },
    [refreshSwaps, notice],
  );

  const revokeSwap = useCallback(
    async (offerId: string) => {
      if (!studentId) return;
      try {
        await regloApi.cancelSwapOffer(offerId, studentId);
        await refreshSwaps();
        notice('Richiesta di sostituzione revocata', 'info');
      } catch (err) {
        notice(err instanceof Error ? err.message : 'Errore durante la revoca', 'danger');
      }
    },
    [studentId, refreshSwaps, notice],
  );

  const cancel = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations) => {
      const run = () =>
        cancelMutation.mutate(lesson.id, {
          onSuccess: () => notificationEvents.requestRefresh(),
          onError: (err) => notice(err instanceof Error ? err.message : 'Errore durante annullamento', 'danger'),
        });
      // REG-780: oltre il preavviso la guida può essere addebitata lo stesso.
      const cutoffHours = settings?.penaltyCutoffHoursPreset ?? 0;
      const late =
        cutoffHours > 0 && Date.now() >= new Date(lesson.startsAt).getTime() - cutoffHours * 3600000;
      Alert.alert(
        'Annullare la guida?',
        late
          ? `Mancano meno di ${cutoffHours} ${cutoffHours === 1 ? 'ora' : 'ore'} alla guida. Se annulli adesso, la guida potrebbe esserti comunque addebitata.`
          : 'Sei sicuro di voler annullare questa guida?',
        [
          { text: 'Indietro', style: 'cancel' },
          { text: 'Annulla guida', style: 'destructive', onPress: run },
        ],
      );
    },
    [cancelMutation, settings?.penaltyCutoffHoursPreset, notice],
  );

  const openUpcoming = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations, all: AutoscuolaAppointmentWithRelations[]) => {
      if (lesson.groupLessonId) {
        groupLessonStudentStore.set({
          groupLessonId: lesson.groupLessonId,
          cutoffHours: settings?.penaltyCutoffHoursPreset ?? 0,
          onChanged: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        });
        router.push(`/(tabs)/${stack}/group-lesson-detail`);
        return;
      }
      const status = (lesson.status ?? '').trim().toLowerCase();
      const type = (lesson.type ?? '').trim().toLowerCase();
      const future = new Date(lesson.startsAt).getTime() > Date.now();
      const swappable = type !== 'group_lesson' && type !== 'esame';
      lessonDetailStore.set({
        lesson,
        canSwap: swappable && future && ['scheduled', 'confirmed'].includes(status) && swapEnabled,
        canCancel: future && canCancel,
        vehiclesEnabled: settings?.vehiclesEnabled !== false,
        activeSwapOfferId: mySwapByAppointment.get(lesson.id) ?? null,
        onSwap: createSwap,
        onCancel: (id) => {
          const target = all.find((a) => a.id === id);
          if (target) cancel(target);
        },
        onRevokeSwap: revokeSwap,
      });
      router.push(`/(tabs)/${stack}/lesson-detail`);
    },
    [settings, swapEnabled, canCancel, mySwapByAppointment, createSwap, cancel, revokeSwap, queryClient, router, stack],
  );

  return useMemo(() => ({ openUpcoming }), [openUpcoming]);
}
