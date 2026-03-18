import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, pink, spacing, typography } from '../theme';

type BadgeTone = 'default' | 'success' | 'warning' | 'danger';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

const toneConfig: Record<BadgeTone, { bg: string; text: string; border: string }> = {
  default: {
    bg: pink[50],
    text: colors.primary,
    border: pink[200],
  },
  success: {
    bg: '#F0FDF4',
    text: '#16A34A',
    border: '#BBF7D0',
  },
  warning: {
    bg: '#FEFCE8',
    text: '#CA8A04',
    border: '#FEF08A',
  },
  danger: {
    bg: '#FEF2F2',
    text: '#DC2626',
    border: '#FECACA',
  },
};

export const Badge = ({ label, tone = 'default' }: BadgeProps) => {
  const t = toneConfig[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.text, { color: t.text }]}>{label}</Text>
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
  },
  text: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
