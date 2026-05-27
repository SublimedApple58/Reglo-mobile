import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Screen } from '../components/Screen';
import { DuckSlot } from '../components/DuckSlot';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export const AllievoLicensedScreen: React.FC = () => {
  const { user } = useSession();
  const firstName = user?.name?.split(' ')[0] ?? '';

  const handleLogout = async () => {
    try {
      await regloApi.logout();
    } catch {
      // ignore — session will be cleared by client anyway
    }
  };

  return (
    <Screen gradient>
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <DuckSlot
              kind="hero-patentato"
              size={108}
              placeholderTone="success"
              accessibilityLabel="Paperotto patentato: hai concluso il percorso"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.textBlock}>
          <Text style={styles.title}>Congratulazioni{firstName ? `, ${firstName}` : ''}!</Text>
          <Text style={styles.subtitle}>
            Hai concluso il tuo percorso. Patente alla mano e buona strada.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.footer}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Esci dall'app"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.logoutText}>Esci dall&apos;app</Text>
          </Pressable>
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
  iconWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
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
    gap: spacing.xs,
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
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  logoutButtonPressed: {
    opacity: 0.85,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default AllievoLicensedScreen;
