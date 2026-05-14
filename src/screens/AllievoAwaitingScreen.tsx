import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Screen } from '../components/Screen';
import { useSession } from '../context/SessionContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Home neutra mostrata agli allievi nello stato AWAITING: si sono registrati
 * con il codice autoscuola ma il titolare non ha ancora assegnato una licenza
 * quiz, quindi né la fase teoria né la fase pratica sono accessibili.
 *
 * Per scelta di prodotto: testo + illustrazione, nessuna CTA. L'allievo non
 * ha azioni da compiere — è l'autoscuola che deve attivarlo dal web.
 */
export const AllievoAwaitingScreen: React.FC = () => {
  const { user } = useSession();
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <Screen gradient>
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.illustrationWrap}>
          <View style={styles.illustrationFrame}>
            <Image
              source={require('../../assets/duck-clock.png')}
              style={styles.illustration}
              resizeMode="contain"
              accessibilityLabel="Paperella con orologio: in attesa di attivazione"
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
    gap: spacing.xl,
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
  illustration: {
    width: 150,
    height: 150,
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
});

export default AllievoAwaitingScreen;
