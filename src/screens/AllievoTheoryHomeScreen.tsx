import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { PhaseProgressBar } from '../components/PhaseProgressBar';
import { useStudentPhase } from '../hooks/useStudentPhase';
import { useSession } from '../context/SessionContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const formatExamDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const computeDaysLeft = (iso: string | null): number | null => {
  if (!iso) return null;
  const exam = new Date(iso).getTime();
  if (Number.isNaN(exam)) return null;
  const ms = exam - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

const buildMilestone = (daysLeft: number | null) => {
  if (daysLeft === null) {
    return {
      title: 'Inizia a studiare',
      subtitle: 'Apri il quiz e completa la tua prima simulazione esame.',
      cta: 'Avvia simulazione',
    };
  }
  if (daysLeft <= 1) {
    return {
      title: 'Domani è il grande giorno',
      subtitle: 'Concentrati sul ripasso degli errori. Sei pronto.',
      cta: 'Rivedi i tuoi errori',
    };
  }
  if (daysLeft <= 7) {
    return {
      title: 'Settimana decisiva',
      subtitle: `Esame fra ${daysLeft} giorni. Fai una simulazione al giorno.`,
      cta: 'Avvia simulazione',
    };
  }
  if (daysLeft <= 30) {
    return {
      title: 'Continua a studiare',
      subtitle: `Esame fra ${daysLeft} giorni. Fai esercizio sui capitoli deboli.`,
      cta: 'Apri capitoli',
    };
  }
  return {
    title: `Mancano ${daysLeft} giorni`,
    subtitle: 'Inizia con calma a fare le prime simulazioni.',
    cta: 'Avvia simulazione',
  };
};

export const AllievoTheoryHomeScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useSession();
  const { theoryExamAt } = useStudentPhase();

  const daysLeft = useMemo(() => computeDaysLeft(theoryExamAt), [theoryExamAt]);
  const examDateLabel = useMemo(() => formatExamDate(theoryExamAt), [theoryExamAt]);
  const milestone = useMemo(() => buildMilestone(daysLeft), [daysLeft]);

  const firstName = user?.name?.split(' ')[0] ?? 'Ciao';

  const goToQuiz = () => router.push('/(tabs)/quiz');
  const goToChapters = () => router.push('/(tabs)/quiz/chapters');

  return (
    <Screen gradient>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(280)} style={styles.header}>
          <Text style={styles.greeting}>Ciao, {firstName}</Text>
          <Text style={styles.subgreeting}>Stai preparando l&apos;esame di teoria</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(60).duration(280)} style={styles.progressCard}>
          <Text style={styles.progressCaption}>IL TUO PERCORSO</Text>
          <PhaseProgressBar phase="TEORIA" theoryExamAt={theoryExamAt} />
        </Animated.View>

        {daysLeft !== null ? (
          <Animated.View entering={FadeInUp.delay(120).duration(280)} style={styles.countdownCard}>
            <View style={styles.countdownRow}>
              <View style={styles.countdownIconWrap}>
                <Ionicons name="calendar" size={20} color={colors.primary} />
              </View>
              <View style={styles.countdownTextWrap}>
                <Text style={styles.countdownLabel}>Esame teoria</Text>
                {examDateLabel ? <Text style={styles.countdownDate}>{examDateLabel}</Text> : null}
              </View>
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownBadgeNumber}>{daysLeft}</Text>
                <Text style={styles.countdownBadgeUnit}>{daysLeft === 1 ? 'giorno' : 'giorni'}</Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.delay(120).duration(280)} style={styles.noticeCard}>
            <Ionicons name="information-circle" size={20} color={colors.primary} style={styles.noticeIcon} />
            <Text style={styles.noticeText}>
              Quando l&apos;autoscuola fisserà la data dell&apos;esame teorico, vedrai qui il
              countdown e riceverai dei reminder.
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(180).duration(280)} style={styles.milestoneCard}>
          <Text style={styles.milestoneCaption}>PROSSIMA TAPPA</Text>
          <Text style={styles.milestoneTitle}>{milestone.title}</Text>
          <Text style={styles.milestoneSubtitle}>{milestone.subtitle}</Text>
          <Pressable
            onPress={goToQuiz}
            style={({ pressed }) => [styles.ctaPrimary, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel={milestone.cta}
          >
            <Ionicons name="play" size={16} color={colors.surface} style={styles.ctaIcon} />
            <Text style={styles.ctaPrimaryText}>{milestone.cta}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(240).duration(280)} style={styles.shortcutsRow}>
          <Pressable
            onPress={goToQuiz}
            style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
            accessibilityRole="button"
            accessibilityLabel="Simulazione esame"
          >
            <Ionicons name="document-text" size={20} color={colors.primary} />
            <Text style={styles.shortcutTitle}>Simulazione</Text>
            <Text style={styles.shortcutSubtitle}>30 domande, 20 min</Text>
          </Pressable>
          <Pressable
            onPress={goToChapters}
            style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
            accessibilityRole="button"
            accessibilityLabel="Capitoli"
          >
            <Ionicons name="library" size={20} color={colors.primary} />
            <Text style={styles.shortcutTitle}>Capitoli</Text>
            <Text style={styles.shortcutSubtitle}>Studia per argomento</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  header: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xs,
    gap: 4,
  },
  greeting: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subgreeting: {
    ...typography.body,
    color: colors.textSecondary,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  progressCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  countdownCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countdownIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pink[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownTextWrap: {
    flex: 1,
  },
  countdownLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  countdownDate: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  countdownBadge: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 64,
  },
  countdownBadgeNumber: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  countdownBadgeUnit: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.9,
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: colors.pink[50],
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  milestoneCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    gap: 6,
  },
  milestoneCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  milestoneTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  milestoneSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  ctaPrimary: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaIcon: {
    marginTop: 1,
  },
  ctaPrimaryText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shortcut: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    gap: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  shortcutPressed: {
    opacity: 0.9,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  shortcutSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default AllievoTheoryHomeScreen;
