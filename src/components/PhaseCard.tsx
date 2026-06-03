import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, pink } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { AutoscuolaStudentPhase } from '../types/regloApi';

type Props = {
  phase: AutoscuolaStudentPhase;
  theoryExamAt?: string | null;
  firstName?: string | null;
  unreadCount?: number;
  onBellPress?: () => void;
};

type PhaseConfig = {
  title: string;
  subtitle: string;
  accentColor: string;
  image: ImageSourcePropType;
};

const PHASE_ORDER: AutoscuolaStudentPhase[] = ['AWAITING', 'TEORIA', 'PRATICA', 'PATENTATO'];

const PHASE_CONFIG: Record<AutoscuolaStudentPhase, PhaseConfig> = {
  AWAITING: {
    title: 'In attesa',
    subtitle: 'Stiamo preparando tutto per il tuo percorso!',
    accentColor: pink[300],
    image: require('../../assets/ducks/duck-step-awaiting.png'),
  },
  TEORIA: {
    title: 'Teoria',
    subtitle: 'Testa sui libri, l\u2019esame si avvicina!',
    accentColor: '#FB923C',
    image: require('../../assets/ducks/duck-step-theory.png'),
  },
  PRATICA: {
    title: 'Foglio rosa',
    subtitle: 'Si va in strada, il volante \u00E8 tuo!',
    accentColor: '#4ADE80',
    image: require('../../assets/ducks/duck-step-pratica.png'),
  },
  PATENTATO: {
    title: 'Patente',
    subtitle: 'Ce l\u2019hai fatta, complimenti!',
    accentColor: '#FACC15',
    image: require('../../assets/ducks/duck-step-patentato.png'),
  },
};

const HERO_IMAGE_SIZE = 280;

export const PhaseCard: React.FC<Props> = ({
  phase,
  theoryExamAt = null,
  firstName,
  unreadCount = 0,
  onBellPress,
}) => {
  const config = PHASE_CONFIG[phase];
  const activeIndex = PHASE_ORDER.indexOf(phase);

  const theoryCountdown = React.useMemo(() => {
    if (phase !== 'TEORIA' || !theoryExamAt) return null;
    const exam = new Date(theoryExamAt).getTime();
    if (Number.isNaN(exam)) return null;
    const daysLeft = Math.max(0, Math.ceil((exam - Date.now()) / (1000 * 60 * 60 * 24)));
    if (daysLeft === 0) return 'Esame oggi!';
    if (daysLeft === 1) return 'Esame domani!';
    return `${daysLeft} giorni all\u2019esame`;
  }, [phase, theoryExamAt]);

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.hero}>
      {/* ── Background mascot image ── */}
      <View style={styles.mascotBg}>
        <Image
          source={config.image}
          style={styles.mascotImage}
          resizeMode="contain"
          accessibilityLabel={`Paperotto ${config.title}`}
        />
        {/* Fade overlay: transparent → page background */}
        <LinearGradient
          colors={['rgba(250,224,239,0)', 'rgba(250,224,239,0.4)', colors.background]}
          locations={[0, 0.5, 1]}
          style={styles.mascotFade}
        />
      </View>

      {/* ── Bell (top-right, above the image) ── */}
      {onBellPress && (
        <View style={styles.bellRow}>
          <Pressable
            onPress={onBellPress}
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Notifiche"
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={16} color="#1a120a" />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>
      )}

      {/* ── Spacer to push text below the image area ── */}
      <View style={{ height: HERO_IMAGE_SIZE * 0.65 }} />

      {/* ── Greeting + Phase title + subtitle ── */}
      <Text style={styles.greeting}>Ciao {firstName ?? 'Allievo'}</Text>
      <Text style={styles.phaseTitle}>{config.title}</Text>
      <Text style={styles.phaseSubtitle}>{config.subtitle}</Text>

      {/* ── Theory countdown badge ── */}
      {theoryCountdown && (
        <View style={[styles.countdownBadge, { backgroundColor: config.accentColor }]}>
          <Text style={styles.countdownText}>{theoryCountdown}</Text>
        </View>
      )}

      {/* ── Step dots ── */}
      <View style={styles.dotsRow}>
        {PHASE_ORDER.map((step, idx) => {
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex;
          return (
            <View
              key={step}
              style={[
                styles.dot,
                isDone && { backgroundColor: config.accentColor, opacity: 0.5 },
                isActive && { backgroundColor: config.accentColor, width: 20 },
              ]}
            />
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  mascotBg: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mascotImage: {
    width: HERO_IMAGE_SIZE,
    height: HERO_IMAGE_SIZE,
    opacity: 0.7,
  },
  mascotFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_IMAGE_SIZE * 0.6,
  },
  bellRow: {
    alignSelf: 'flex-end',
    zIndex: 2,
    marginBottom: spacing.sm,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
    zIndex: 1,
  },
  phaseTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
    zIndex: 1,
  },
  phaseSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    zIndex: 1,
  },
  countdownBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: spacing.sm,
    zIndex: 1,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
    zIndex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
});

export default PhaseCard;
