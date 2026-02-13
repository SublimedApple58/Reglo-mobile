import React from 'react';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, TextInput, View, TextInputProps } from 'react-native';
import { colors, spacing, typography } from '../theme';

type GlassInputProps = TextInputProps & {
  label?: string;
};

export const GlassInput = ({ label, style, ...props }: GlassInputProps) => {
  const isIOS = Platform.OS === 'ios';
  return (
    <View style={[styles.wrapper, isIOS ? styles.wrapperIOS : styles.wrapperAndroid]}>
      {isIOS ? <BlurView intensity={24} tint="light" style={styles.blur} /> : null}
      <View style={styles.surface}>
        <TextInput
          placeholderTextColor={isIOS ? colors.textMuted : colors.textSecondary}
          {...props}
          style={[styles.input, isIOS ? styles.inputIOS : styles.inputAndroid, style]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  wrapperIOS: {
    borderColor: colors.glassBorder,
  },
  wrapperAndroid: {
    borderColor: 'rgba(50, 77, 122, 0.18)',
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(50, 77, 122, 0.18)',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  surface: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  blur: {
    borderRadius: 16,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  inputIOS: {
    paddingVertical: spacing.sm,
    backgroundColor: colors.glass,
  },
  inputAndroid: {
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
  },
});
