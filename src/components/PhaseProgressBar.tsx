import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { AutoscuolaStudentPhase } from '../types/regloApi';

type Props = {
  phase: AutoscuolaStudentPhase;
  theoryExamAt?: string | null;
  /** Compact variant — used as header strip in PRATICA home. Default false (full hero). */
  compact?: boolean;
};

const STEPS: Array<{ key: AutoscuolaStudentPhase; label: string }> = [
  { key: 'TEORIA', label: 'Teoria' },
  { key: 'PRATICA', label: 'Foglio rosa' },
  { key: 'PATENTATO', label: 'Patente' },
];

const BASE_TEORIA_PROGRESS = 0.05;
const COUNTDOWN_DAYS = 30;

const computeProgress = (
  phase: AutoscuolaStudentPhase,
  theoryExamAt: string | null,
): number => {
  if (phase === 'PATENTATO') return 1;
  if (phase === 'PRATICA') return 0.5;
  // TEORIA
  if (!theoryExamAt) return BASE_TEORIA_PROGRESS / 3;
  const exam = new Date(theoryExamAt).getTime();
  if (Number.isNaN(exam)) return BASE_TEORIA_PROGRESS / 3;
  const now = Date.now();
  const daysLeft = Math.max(0, (exam - now) / (1000 * 60 * 60 * 24));
  const segmentProgress = Math.min(
    1,
    Math.max(BASE_TEORIA_PROGRESS, 1 - daysLeft / COUNTDOWN_DAYS),
  );
  return segmentProgress / 3;
};

export const PhaseProgressBar: React.FC<Props> = ({ phase, theoryExamAt = null, compact = false }) => {
  const progress = useMemo(() => computeProgress(phase, theoryExamAt), [phase, theoryExamAt]);
  const activeIndex = STEPS.findIndex((s) => s.key === phase);

  return (
    <Animated.View entering={FadeIn.duration(280)} style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.trackWrapper}>
        <View style={styles.track} />
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        {STEPS.map((step, idx) => {
          const isActive = idx === activeIndex;
          const isDone = idx < activeIndex;
          const left = `${(idx / (STEPS.length - 1)) * 100}%` as const;
          return (
            <View key={step.key} style={[styles.checkpoint, { left }]}>
              <View
                style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isActive && styles.dotActive,
                ]}
              >
                {isDone && <View style={styles.dotInnerDone} />}
                {isActive && <View style={styles.dotInnerActive} />}
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {STEPS.map((step, idx) => {
          const isActive = idx === activeIndex;
          const isDone = idx < activeIndex;
          return (
            <Text
              key={step.key}
              style={[
                styles.label,
                isDone && styles.labelDone,
                isActive && styles.labelActive,
                compact && styles.labelCompact,
              ]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          );
        })}
      </View>
    </Animated.View>
  );
};

const DOT_SIZE = 18;
const DOT_INNER = 8;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  containerCompact: {
    paddingVertical: spacing.sm,
  },
  trackWrapper: {
    height: DOT_SIZE,
    justifyContent: 'center',
    marginHorizontal: DOT_SIZE / 2,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  checkpoint: {
    position: 'absolute',
    transform: [{ translateX: -DOT_SIZE / 2 }],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  dotInnerDone: {
    width: DOT_INNER,
    height: DOT_INNER,
    borderRadius: DOT_INNER / 2,
    backgroundColor: colors.surface,
  },
  dotInnerActive: {
    width: DOT_INNER,
    height: DOT_INNER,
    borderRadius: DOT_INNER / 2,
    backgroundColor: colors.primary,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 11,
  },
  labelDone: {
    color: colors.primary,
  },
  labelActive: {
    color: colors.textPrimary,
  },
});

export default PhaseProgressBar;
