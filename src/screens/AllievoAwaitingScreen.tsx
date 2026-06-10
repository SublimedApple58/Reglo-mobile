import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Screen } from '../components/Screen';
import { DuckSlot } from '../components/DuckSlot';
import { PhaseProgressBar } from '../components/PhaseProgressBar';
import { useSession } from '../context/SessionContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Home neutra mostrata agli allievi nello stato AWAITING: si sono registrati
 * con il codice autoscuola ma il titolare non ha ancora assegnato una licenza
 * quiz, quindi né la fase teoria né la fase pratica sono accessibili.
 *
 * Per scelta di prodotto: testo + illustrazione paperotto + timeline percorso,
 * nessuna CTA. L'allievo non ha azioni da compiere — è l'autoscuola che deve
 * attivarlo dal web. La timeline gli mostra dove si trova nel viaggio.
 */
export const AllievoAwaitingScreen: React.FC = () => {
  const { user } = useSession();
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <Screen gradient>
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.illustrationWrap}>
          <View style={styles.illustrationFrame}>
            <DuckSlot
              kind="hero-awaiting"
              size={170}
              placeholderTone="active"
              accessibilityLabel="Paperotto in attesa: il tuo percorso sta per iniziare"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.textBlock}>
          <Text style={styles.title}>
            {firstName ? `Ci siamo quasi, ${firstName}` : 'Ci siamo quasi'}
          </Text>
          <Text style={styles.subtitle}>
            Stai per iniziare il tuo percorso. La tua autoscuola attiverà
            l&apos;accesso a breve. Riceverai una notifica appena sarà pronto.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.progressCard}>
          <Text style={styles.progressCaption}>IL TUO PERCORSO</Text>
          <PhaseProgressBar phase="AWAITING" />
        </Animated.View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  illustrationWrap: {
    alignItems: 'center',
  },
  illustrationFrame: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 22,
  },
  progressCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  progressCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
});

export default AllievoAwaitingScreen;
