import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

const NAVY = '#1A1A2E';
const NAVY_400 = '#6E7596';
const NAVY_300 = '#AEB4CC';
const NAVY_100 = '#E9EBF2';
const IVORY = '#F5EFE6';

type AuthFieldProps = TextInputProps & {
  label: string;
  /** Dark variant for the navy (Android B1 / welcome) screens. */
  dark?: boolean;
  /** Render a Mostra/Nascondi toggle and manage secure entry. */
  password?: boolean;
};

export const AuthField = ({
  label,
  dark = false,
  password = false,
  style,
  onFocus,
  onBlur,
  ...props
}: AuthFieldProps) => {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, dark ? styles.labelDark : styles.labelLight]}>{label}</Text>
      <View
        style={[
          styles.field,
          dark ? styles.fieldDark : styles.fieldLight,
          focused && (dark ? styles.fieldDarkFocus : styles.fieldLightFocus),
        ]}
      >
        <TextInput
          {...props}
          secureTextEntry={password ? hidden : props.secureTextEntry}
          placeholderTextColor={dark ? '#7E84A0' : '#9AA1BB'}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, dark ? styles.inputDark : styles.inputLight, style]}
        />
        {password ? (
          <Pressable hitSlop={10} onPress={() => setHidden((h) => !h)}>
            <Text style={[styles.toggle, dark ? styles.toggleDark : styles.toggleLight]}>
              {hidden ? 'Mostra' : 'Nascondi'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 13 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, marginLeft: 3 },
  labelLight: { color: '#14141F' },
  labelDark: { color: NAVY_300 },
  field: {
    height: 54,
    borderRadius: 15,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  fieldLight: { backgroundColor: '#FFFFFF', borderColor: NAVY_100 },
  fieldLightFocus: { borderColor: NAVY },
  fieldDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(245,239,230,0.16)' },
  fieldDarkFocus: { borderColor: 'rgba(245,239,230,0.55)', backgroundColor: 'rgba(255,255,255,0.08)' },
  input: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
  inputLight: { color: NAVY },
  inputDark: { color: IVORY },
  toggle: { fontSize: 12.5, fontWeight: '600' },
  toggleLight: { color: NAVY_400 },
  toggleDark: { color: NAVY_300 },
});
