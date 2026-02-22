import React from 'react';
import { BlurView } from 'expo-blur';
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

export type GlassCardHierarchy = 'primary' | 'secondary' | 'tertiary';

type GlassCardProps = {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hierarchy?: GlassCardHierarchy;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

const getHierarchyStyles = (hierarchy: GlassCardHierarchy) => {
  if (hierarchy === 'primary') {
    return {
      card: styles.cardPrimary,
      overlay: styles.overlayPrimary,
      title: styles.titlePrimary,
      subtitle: styles.subtitlePrimary,
    };
  }
  if (hierarchy === 'tertiary') {
    return {
      card: styles.cardTertiary,
      overlay: styles.overlayTertiary,
      title: styles.titleTertiary,
      subtitle: styles.subtitleTertiary,
    };
  }
  return {
    card: styles.cardSecondary,
    overlay: styles.overlaySecondary,
    title: styles.titleSecondary,
    subtitle: styles.subtitleSecondary,
  };
};

export const GlassCard = ({
  title,
  subtitle,
  children,
  style,
  hierarchy = 'secondary',
  titleStyle,
  subtitleStyle,
}: GlassCardProps) => {
  const isIOS = Platform.OS === 'ios';
  const hierarchyStyles = getHierarchyStyles(hierarchy);
  return (
    <View
      style={[
        styles.card,
        isIOS ? styles.cardIOS : styles.cardAndroid,
        hierarchyStyles.card,
        style,
      ]}
    >
      {isIOS ? <BlurView intensity={24} tint="light" style={styles.blur} /> : null}
      <View
        style={[
          styles.overlay,
          isIOS ? styles.overlayIOS : styles.overlayAndroid,
          hierarchyStyles.overlay,
        ]}
      >
        {title ? <Text style={[styles.title, hierarchyStyles.title, titleStyle]}>{title}</Text> : null}
        {subtitle ? (
          <Text style={[styles.subtitle, hierarchyStyles.subtitle, subtitleStyle]}>{subtitle}</Text>
        ) : null}
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
  cardPrimary: {
    borderRadius: 24,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: 'rgba(50, 77, 122, 0.55)',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
  },
  cardSecondary: {
    borderColor: 'rgba(255, 255, 255, 0.72)',
  },
  cardTertiary: {
    borderColor: 'rgba(255, 255, 255, 0.62)',
    shadowColor: 'rgba(50, 77, 122, 0.25)',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
  overlayPrimary: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  overlaySecondary: {
    gap: spacing.sm,
  },
  overlayTertiary: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
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
});
