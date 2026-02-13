import React from 'react';
import { BlurView } from 'expo-blur';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';

type GlassCardProps = {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const GlassCard = ({ title, subtitle, children, style }: GlassCardProps) => {
  const isIOS = Platform.OS === 'ios';
  return (
    <View style={[styles.card, isIOS ? styles.cardIOS : styles.cardAndroid, style]}>
      {isIOS ? <BlurView intensity={24} tint="light" style={styles.blur} /> : null}
      <View style={[styles.overlay, isIOS ? styles.overlayIOS : styles.overlayAndroid]}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
  },
  cardIOS: {
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    shadowColor: 'rgba(50, 77, 122, 0.5)',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: 'visible',
  },
  cardAndroid: {
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: 'rgba(27, 43, 68, 0.2)',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  overlay: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  overlayIOS: {
    backgroundColor: colors.glass,
    borderRadius: 20,
  },
  overlayAndroid: {
    backgroundColor: 'transparent',
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
