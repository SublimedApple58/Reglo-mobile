import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

export type CardHierarchy = 'primary' | 'secondary' | 'tertiary';
export type CardVariant = 'default' | 'dark';

type CardProps = {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hierarchy?: CardHierarchy;
  variant?: CardVariant;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

const getHierarchyStyles = (hierarchy: CardHierarchy) => {
  if (hierarchy === 'primary') {
    return {
      card: styles.cardPrimary,
      title: styles.titlePrimary,
      subtitle: styles.subtitlePrimary,
    };
  }
  if (hierarchy === 'tertiary') {
    return {
      card: styles.cardTertiary,
      title: styles.titleTertiary,
      subtitle: styles.subtitleTertiary,
    };
  }
  return {
    card: styles.cardSecondary,
    title: styles.titleSecondary,
    subtitle: styles.subtitleSecondary,
  };
};

export const Card = ({
  title,
  subtitle,
  children,
  style,
  hierarchy = 'secondary',
  variant = 'default',
  titleStyle,
  subtitleStyle,
}: CardProps) => {
  const hierarchyStyles = getHierarchyStyles(hierarchy);
  const isDark = variant === 'dark';

  return (
    <View
      style={[
        styles.card,
        hierarchyStyles.card,
        isDark && styles.cardDark,
        style,
      ]}
    >
      {title ? (
        <Text style={[styles.title, hierarchyStyles.title, isDark && styles.titleDark, titleStyle]}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={[styles.subtitle, hierarchyStyles.subtitle, isDark && styles.subtitleDark, subtitleStyle]}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPrimary: {
    borderRadius: radii.lg,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  cardSecondary: {
    gap: spacing.sm,
  },
  cardTertiary: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  titlePrimary: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  titleSecondary: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
  },
  titleTertiary: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: 0,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  subtitlePrimary: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  subtitleSecondary: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  subtitleTertiary: {
    ...typography.caption,
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  subtitleDark: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
