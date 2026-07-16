import React, { useState } from 'react';
import { StyleSheet, TextInput, View, TextInputProps } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import { useDoneAccessory } from './KeyboardDoneAccessory';

type InputProps = TextInputProps & {
  label?: string;
};

const NUMERIC_KEYBOARDS = ['numeric', 'number-pad', 'phone-pad', 'decimal-pad'];

export const Input = ({ label, style, onFocus, onBlur, ...props }: InputProps) => {
  const [focused, setFocused] = useState(false);

  // Numeric keyboards have no return key and multiline fields treat return as a
  // newline — both need the iOS "Fatto" toolbar to dismiss. Wired automatically
  // so every <Input> consumer gets it for free (no-op on Android / other types).
  const needsAccessory = Boolean(props.multiline) || NUMERIC_KEYBOARDS.includes(props.keyboardType as string);
  const { accessoryID, accessory } = useDoneAccessory();

  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused]}>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        inputAccessoryViewID={needsAccessory ? accessoryID : props.inputAccessoryViewID}
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
      {needsAccessory ? accessory : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#F7F7F7',
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
