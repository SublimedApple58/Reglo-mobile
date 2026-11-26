import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ClayList, ClayListRow, ClaySection, markClayRow } from '../clay';
import { SkeletonBlock } from '../Skeleton';
import type { ToastTone } from '../ToastNotice';
import { useInstructorAbsences } from '../../hooks/queries/useInstructorAbsences';
import { useStackBase } from '../../hooks/useStackBase';
import { useSession } from '../../context/SessionContext';
import { regloApi } from '../../services/regloApi';
import { sickLeaveSheetStore, type LeaveKind } from '../../stores/sickLeaveSheetStore';
import { absenceWord, periodRange, periodSubtitle, periodTitle, type AbsencePeriod } from '../../utils/absencePeriods';
import { CLAY } from '../../theme/clay';
import { SOFT_SPRING, softEnter } from '../../utils/motion';
import * as Haptics from '../../utils/haptics';

const MAX_SWIPE = 116;
const SWIPE_THRESHOLD = 76;

/**
 * REG-794 «Assenze» nella disponibilità di un istruttore vista dal titolare:
 * segna malattia o ferie (lo stesso foglio, `home/sick-leave`), poi i periodi
 * registrati, che si eliminano trascinandoli a sinistra (con conferma). Niente
 * scrittura ottimistica: si elimina, poi si rilegge dal backend.
 */
export function AbsencesSection({
  instructorId,
  firstName,
  onToast,
}: {
  instructorId: string;
  firstName: string;
  onToast: (text: string, tone?: ToastTone) => void;
}) {
  const router = useRouter();
  const stackBase = useStackBase('home');
  const queryClient = useQueryClient();
  const { activeCompanyId } = useSession();
  const absences = useInstructorAbsences(instructorId);
  const periods = absences.data ?? [];
  const loading = absences.isLoading && !absences.data;

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['instructor-absences', activeCompanyId] }),
      queryClient.invalidateQueries({ queryKey: ['agenda-bootstrap', activeCompanyId] }),
    ]);
  }, [queryClient, activeCompanyId]);

  const openLeave = (kind: LeaveKind) => {
    sickLeaveSheetStore.set({
      kind,
      initialDate: new Date().toISOString(),
      instructorId,
      forInstructorName: firstName,
      onApplied: refresh,
      onDone: (msg) => onToast(msg, 'success'),
    });
    router.push(`/(tabs)/${stackBase}/sick-leave` as never);
  };

  const askDelete = useCallback((p: AbsencePeriod) => {
    Alert.alert(
      `Eliminare ${p.kind === 'sick' ? 'la malattia' : 'le ferie'} di ${firstName}?`,
      `${absenceWord(p.kind)} · ${periodRange(p)}. Le guide già annullate restano annullate.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                for (const id of p.blockIds) await regloApi.deleteInstructorBlock(id);
                await refresh();
                onToast('Periodo eliminato', 'success');
              } catch (err) {
                onToast(err instanceof Error ? err.message : "Errore nell'eliminazione", 'danger');
                void refresh();
              }
            })();
          },
        },
      ],
    );
  }, [firstName, refresh, onToast]);

  return (
    <View>
      <ClaySection title="Assenze" style={s.section}>
        <ClayList>
          <ClayListRow
            title="Segna malattia"
            subtitle="Da oggi o da un giorno a scelta"
            onPress={() => openLeave('sick')}
            testID="absences-sick"
          />
          <ClayListRow
            title="Segna ferie"
            subtitle="Un periodo di più giorni"
            onPress={() => openLeave('vacation')}
            testID="absences-vacation"
          />
        </ClayList>
      </ClaySection>

      <ClaySection
        title="Periodi registrati"
        style={s.periods}
        footnote={
          loading
            ? undefined
            : periods.length
              ? 'Trascina un periodo a sinistra per eliminarlo. Le guide già annullate restano annullate.'
              : 'Nessuna malattia o ferie registrata.'
        }
      >
        {loading ? (
          <ClayList>
            {[0, 1].map((i) => (
              <View key={i} style={s.skRow}>
                <SkeletonBlock width={150} height={15} radius={7} />
                <SkeletonBlock width={110} height={12} radius={6} style={s.skSub} />
              </View>
            ))}
          </ClayList>
        ) : periods.length ? (
          <Animated.View entering={softEnter()}>
            <ClayList>
              {periods.map((p) => (
                <PeriodRow key={p.key} period={p} onDelete={askDelete} />
              ))}
            </ClayList>
          </Animated.View>
        ) : null}
      </ClaySection>
    </View>
  );
}

/** Un periodo: trascinato a sinistra rivela «Elimina»; oltre la soglia chiede conferma. */
const PeriodRow = React.memo(function PeriodRow({
  period,
  onDelete,
  divider,
  first,
  last,
}: {
  period: AbsencePeriod;
  onDelete: (p: AbsencePeriod) => void;
  divider?: boolean;
  first?: boolean;
  last?: boolean;
}) {
  const tx = useSharedValue(0);
  const commit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDelete(period);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      tx.value = Math.max(-MAX_SWIPE, Math.min(0, e.translationX));
    })
    .onEnd(() => {
      if (tx.value <= -SWIPE_THRESHOLD) {
        runOnJS(commit)();
        tx.value = withTiming(0, { duration: 220 });
      } else {
        tx.value = withSpring(0, SOFT_SPRING);
      }
    });

  const fgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-tx.value, [8, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={s.row}>
      {divider ? <View style={s.divider} /> : null}
      <Animated.View style={[s.action, actionStyle]} pointerEvents="none">
        <Text style={s.actionText}>Elimina</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[s.fg, fgStyle]}>
          <ClayListRow
            title={periodTitle(period)}
            subtitle={periodSubtitle(period)}
            chevron={false}
            first={first}
            last={last}
            testID={`absence-${period.key}`}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
});
markClayRow(PeriodRow);

const s = StyleSheet.create({
  section: { marginTop: 34 },
  periods: { marginTop: 26 },
  row: { overflow: 'hidden' },
  divider: {
    position: 'absolute', top: 0, left: 18, right: 18, zIndex: 1,
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)',
  },
  fg: { backgroundColor: CLAY.surface },
  action: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: MAX_SWIPE,
    alignItems: 'center', justifyContent: 'center',
  },
  actionText: { fontSize: 15, fontWeight: '600', color: '#C13515', letterSpacing: -0.2 },
  skRow: { paddingVertical: 14, paddingHorizontal: 18, minHeight: 62, justifyContent: 'center' },
  skSub: { marginTop: 7 },
});
