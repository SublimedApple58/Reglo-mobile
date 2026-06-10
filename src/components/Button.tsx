import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

type ButtonTone = 'standard' | 'primary' | 'danger' | 'secondary';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Shows a spinner in place of the label (the label stays stable, no text swap). */
  loading?: boolean;
};

type ToneStyle = {
  bg: string;
  border: string;
  text: string;
};

const tones: Record<ButtonTone, ToneStyle> = {
  primary: {
    bg: colors.primary,
    border: colors.primary,
    text: '#FFFFFF',
  },
  standard: {
    bg: '#FFFFFF',
    border: colors.border,
    text: colors.textPrimary,
  },
  danger: {
    bg: '#FFFFFF',
    border: colors.destructive,
    text: colors.destructive,
  },
  secondary: {
    bg: '#FFFFFF',
    border: colors.accent,
    text: '#A16207',
  },
};

export const Button = ({
  label,
  onPress,
  tone = 'standard',
  disabled = false,
  fullWidth = false,
  loading = false,
}: ButtonProps) => {
  const t = tones[tone];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.root,
        fullWidth && styles.fullWidth,
        { backgroundColor: t.bg, borderColor: t.border },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={t.text} />
      ) : (
        <Text style={[styles.label, { color: t.text }, isDisabled && styles.labelDisabled]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    borderRadius: radii.sm,
    borderWidth: 1,
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  label: {
    ...typography.body,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
