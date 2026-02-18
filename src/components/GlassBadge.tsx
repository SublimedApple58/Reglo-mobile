import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

type GlassBadgeProps = {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
};

const toneColors = {
  default: colors.navy,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

export const GlassBadge = ({ label, tone = 'default' }: GlassBadgeProps) => {
  return (
    <View style={[styles.badge, { borderColor: toneColors[tone] }]}>
      <Text style={[styles.text, { color: toneColors[tone] }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    shadowColor: 'rgba(50, 77, 122, 0.35)',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  text: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
