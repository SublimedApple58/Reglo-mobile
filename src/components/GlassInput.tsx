import React from 'react';
import { BlurView } from 'expo-blur';
import { StyleSheet, TextInput, View, TextInputProps } from 'react-native';
import { colors, spacing, typography } from '../theme';

type GlassInputProps = TextInputProps & {
  label?: string;
};

export const GlassInput = ({ label, style, ...props }: GlassInputProps) => {
  return (
    <View style={styles.wrapper}>
      <BlurView intensity={24} tint="light" style={styles.blur}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          {...props}
          style={[styles.input, style]}
        />
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  blur: {
    borderRadius: 16,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glass,
  },
});
