import React, { useState } from 'react';
import { StyleSheet, TextInput, View, TextInputProps } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

type InputProps = TextInputProps & {
  label?: string;
};

export const Input = ({ label, style, onFocus, onBlur, ...props }: InputProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused]}>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, style]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  wrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
});
