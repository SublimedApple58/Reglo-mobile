import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { DuckSlot, type DuckKind } from './DuckSlot';
import type { AutoscuolaStudentPhase } from '../types/regloApi';

type Props = {
  phase: AutoscuolaStudentPhase;
  theoryExamAt?: string | null;
  /** Compact variant — used as header strip in PRATICA home. Default false (full hero). */
  compact?: boolean;
};

type Step = {
  key: AutoscuolaStudentPhase;
  label: string;
  duckKind: DuckKind;
};

const STEPS: Step[] = [
  { key: 'AWAITING', label: 'In attesa', duckKind: 'step-awaiting' },
  { key: 'TEORIA', label: 'Teoria', duckKind: 'step-theory' },
  { key: 'PRATICA', label: 'Foglio rosa', duckKind: 'step-pratica' },
  { key: 'PATENTATO', label: 'Patente', duckKind: 'step-patentato' },
];

const BASE_TEORIA_PROGRESS = 0.05;
const COUNTDOWN_DAYS = 30;

/**
 * Returns progress in [0, 1] across the 4-step journey
 * AWAITING (0%) → TEORIA (~33%) → PRATICA (~66%) → PATENTATO (100%).
 * Within TEORIA we lerp toward the next checkpoint as the theory exam
 * approaches (so the bar visually grows as the exam date gets closer).
 */
const computeProgress = (
  phase: AutoscuolaStudentPhase,
  theoryExamAt: string | null,
): number => {
  const segments = STEPS.length - 1; // 3 segments between 4 checkpoints
  const baseFor = (idx: number) => idx / segments;

  if (phase === 'PATENTATO') return 1;
  if (phase === 'PRATICA') return baseFor(2); // 2/3
  if (phase === 'AWAITING') return 0;
  // TEORIA — base at segment 1/3, can grow up to 2/3 with countdown.
  const start = baseFor(1);
  const end = baseFor(2);
  if (!theoryExamAt) return start + (end - start) * BASE_TEORIA_PROGRESS;
  const exam = new Date(theoryExamAt).getTime();
  if (Number.isNaN(exam)) return start + (end - start) * BASE_TEORIA_PROGRESS;
  const now = Date.now();
  const daysLeft = Math.max(0, (exam - now) / (1000 * 60 * 60 * 24));
  const within = Math.min(1, Math.max(BASE_TEORIA_PROGRESS, 1 - daysLeft / COUNTDOWN_DAYS));
  return start + (end - start) * within;
};

export const PhaseProgressBar: React.FC<Props> = ({ phase, theoryExamAt = null, compact = false }) => {
  const progress = useMemo(() => computeProgress(phase, theoryExamAt), [phase, theoryExamAt]);
  const activeIndex = STEPS.findIndex((s) => s.key === phase);

  const duckSize = compact ? 28 : 44;

  return (
    <Animated.View entering={FadeIn.duration(280)} style={[styles.container, compact && styles.containerCompact]}>
      {/* ── Row of duck slots (always shown — anchors the step to the mascot) ── */}
      <View style={[styles.ducksRow, { height: duckSize + spacing.xs }]}>
        {STEPS.map((step, idx) => {
          const isActive = idx === activeIndex;
          const isDone = idx < activeIndex;
          const left = `${(idx / (STEPS.length - 1)) * 100}%` as const;
          return (
            <View
              key={`duck-${step.key}`}
              style={[styles.duckWrap, { left, transform: [{ translateX: -duckSize / 2 }] }]}
            >
              <DuckSlot
                kind={step.duckKind}
                size={duckSize}
                active={isActive}
                placeholderTone={isActive ? 'active' : isDone ? 'success' : 'muted'}
                accessibilityLabel={`Step ${step.label}${isActive ? ' (corrente)' : ''}`}
              />
            </View>
          );
        })}
      </View>

      {/* ── Track + checkpoints ── */}
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

      {/* ── Labels ── */}
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
  ducksRow: {
    position: 'relative',
    marginHorizontal: DOT_SIZE / 2,
    marginBottom: spacing.xs,
  },
  duckWrap: {
    position: 'absolute',
    bottom: 0,
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
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 10,
  },
  labelDone: {
    color: colors.primary,
  },
  labelActive: {
    color: colors.textPrimary,
  },
});

export default PhaseProgressBar;
