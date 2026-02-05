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
    borderWidth: 1,
    backgroundColor: colors.glassStrong,
  },
  text: {
    ...typography.caption,
    textTransform: 'uppercase',
  },
});
