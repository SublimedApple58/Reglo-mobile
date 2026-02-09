import React from 'react';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';

type GlassButtonProps = {
  label: string;
  onPress?: () => void;
  tone?: 'standard' | 'primary' | 'danger';
  disabled?: boolean;
  fullWidth?: boolean;
};

type ToneStyle = {
  root: Pick<ViewStyle, 'backgroundColor' | 'borderColor'>;
  label: Pick<TextStyle, 'color'>;
  shadow?: ViewStyle;
};

const toneStyles: Record<'standard' | 'primary' | 'danger', ToneStyle> = {
  standard: {
    root: {
      backgroundColor: colors.glassStrong,
      borderColor: colors.glassBorder,
    },
    label: {
      color: colors.textPrimary,
    },
  },
  primary: {
    root: {
      backgroundColor: colors.navy,
      borderColor: 'rgba(50, 77, 122, 0.8)',
    },
    shadow: {
      shadowColor: 'rgba(50, 77, 122, 0.9)',
      shadowOpacity: 0.55,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    label: {
      color: '#FFFFFF',
    },
  },
  danger: {
    root: {
      backgroundColor: colors.danger,
      borderColor: 'rgba(226, 109, 109, 0.75)',
    },
    shadow: {
      shadowColor: 'rgba(226, 109, 109, 0.7)',
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 9,
    },
    label: {
      color: '#FFFFFF',
    },
  },
};

export const GlassButton = ({
  label,
  onPress,
  tone = 'standard',
  disabled = false,
  fullWidth = false,
}: GlassButtonProps) => {
  const toneStyle = toneStyles[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.shadowWrap,
        fullWidth && styles.fullWidth,
        toneStyle.shadow,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.surface,
          { backgroundColor: toneStyle.root.backgroundColor },
          { borderColor: toneStyle.root.borderColor },
          fullWidth && styles.surfaceFull,
        ]}
      >
        <BlurView intensity={18} tint="light" style={styles.blur} />
        <View style={[styles.content, fullWidth && styles.contentFull]}>
          <Text style={[styles.label, toneStyle.label, disabled && styles.labelDisabled]}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: 16,
    shadowColor: 'rgba(50, 77, 122, 0.6)',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fullWidth: {
    width: '100%',
    alignSelf: 'stretch',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
  surface: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  surfaceFull: {
    width: '100%',
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  contentFull: {
    width: '100%',
  },
  label: {
    ...typography.body,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
