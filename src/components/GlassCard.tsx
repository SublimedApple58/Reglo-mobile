import React from 'react';
import { BlurView } from 'expo-blur';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';

type GlassCardProps = {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const GlassCard = ({ title, subtitle, children, style }: GlassCardProps) => {
  return (
    <View style={[styles.card, style]}>
      <BlurView intensity={24} tint="light" style={styles.blur} />
      <View style={styles.overlay}>
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
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    shadowColor: 'rgba(50, 77, 122, 0.5)',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: 'visible',
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  overlay: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderRadius: 20,
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
