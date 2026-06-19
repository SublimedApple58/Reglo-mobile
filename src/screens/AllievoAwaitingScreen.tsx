import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Screen } from '../components/Screen';
import { PhaseTimeline } from '../components/PhaseTimeline';
import { useSession } from '../context/SessionContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

/**
 * Home neutra mostrata agli allievi nello stato AWAITING: si sono registrati
 * con il codice autoscuola ma il titolare non ha ancora assegnato una licenza
 * quiz, quindi né la fase teoria né la fase pratica sono accessibili.
 *
 * Design: stile "Airbnb" — hero 3D clay (razzo, tinta navy) che fluttua,
 * titolo calmo, e il percorso come timeline verticale a itinerario. Nessuna
 * CTA: è l'autoscuola che deve attivare l'allievo dal web.
 */
const HERO = require('../../assets/icons-3d/rocket.png');

export const AllievoAwaitingScreen: React.FC = () => {
  const { user } = useSession();
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.heroWrap}>
          <View style={styles.heroGlow} />
          <View style={styles.heroShadow} />
          <Image
            source={HERO}
            resizeMode="contain"
            style={styles.heroIcon}
            accessibilityLabel="Razzo: il tuo percorso sta per iniziare"
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          style={styles.textBlock}
        >
          <Text style={styles.title}>
            {firstName ? `Ci siamo quasi, ${firstName}` : 'Ci siamo quasi'}
          </Text>
          <Text style={styles.subtitle}>
            Stai per iniziare il tuo percorso. La tua autoscuola attiverà
            l&apos;accesso a breve: ti avviseremo appena sarà pronto.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(220).duration(400)}
          style={styles.card}
        >
          <Text style={styles.caption}>IL TUO PERCORSO</Text>
          <PhaseTimeline phase="AWAITING" />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    width: 200,
    height: 184,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(26, 26, 46, 0.05)',
  },
  heroShadow: {
    position: 'absolute',
    bottom: 22,
    width: 116,
    height: 20,
    borderRadius: 60,
    backgroundColor: 'rgba(26, 26, 46, 0.12)',
  },
  heroIcon: {
    width: 156,
    height: 156,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  textBlock: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 27,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 22,
    maxWidth: 320,
  },
  card: {
    width: '100%',
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.navy[100],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 2,
  },
  caption: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginBottom: spacing.md,
    marginLeft: 2,
  },
});

export default AllievoAwaitingScreen;
