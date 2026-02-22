import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

export type SectionHeaderHierarchy = 'primary' | 'secondary' | 'tertiary';

type SectionHeaderProps = {
  title: string;
  action?: string;
  subtitle?: string;
  hierarchy?: SectionHeaderHierarchy;
};

const getHierarchyStyles = (hierarchy: SectionHeaderHierarchy) => {
  if (hierarchy === 'primary') {
    return {
      title: styles.titlePrimary,
      subtitle: styles.subtitlePrimary,
      actionPill: styles.actionPillPrimary,
      action: styles.actionPrimary,
    };
  }
  if (hierarchy === 'tertiary') {
    return {
      title: styles.titleTertiary,
      subtitle: styles.subtitleTertiary,
      actionPill: styles.actionPillTertiary,
      action: styles.actionTertiary,
    };
  }
  return {
    title: styles.titleSecondary,
    subtitle: styles.subtitleSecondary,
    actionPill: styles.actionPillSecondary,
    action: styles.actionSecondary,
  };
};

export const SectionHeader = ({
  title,
  action,
  subtitle,
  hierarchy = 'secondary',
}: SectionHeaderProps) => {
  const hierarchyStyles = getHierarchyStyles(hierarchy);
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={[styles.title, hierarchyStyles.title]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, hierarchyStyles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <View style={[styles.actionPill, hierarchyStyles.actionPill]}>
          <Text style={[styles.action, hierarchyStyles.action]}>{action}</Text>
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
  titlePrimary: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  titleSecondary: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  titleTertiary: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.2,
    textTransform: 'none',
  },
  subtitlePrimary: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  subtitleSecondary: {
    fontSize: 12,
  },
  subtitleTertiary: {
    fontSize: 11,
    color: colors.textMuted,
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
  actionPillPrimary: {
    borderColor: 'rgba(50, 77, 122, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    shadowColor: 'rgba(50, 77, 122, 0.28)',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionPillSecondary: {
    borderColor: 'rgba(50, 77, 122, 0.22)',
  },
  actionPillTertiary: {
    borderColor: 'rgba(124, 140, 170, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  action: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  actionPrimary: {
    fontWeight: '700',
  },
  actionSecondary: {
    fontWeight: '600',
  },
  actionTertiary: {
    color: colors.textMuted,
    fontWeight: '600',
  },
});
