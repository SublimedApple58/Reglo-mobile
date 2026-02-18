import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

type SectionHeaderProps = {
  title: string;
  action?: string;
  subtitle?: string;
};

export const SectionHeader = ({ title, action, subtitle }: SectionHeaderProps) => {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <View style={styles.actionPill}>
          <Text style={styles.action}>{action}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.2,
    textTransform: 'none',
  },
  actionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  action: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0.2,
  },
});
