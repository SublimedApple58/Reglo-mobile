import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CLAY, CLAY_SHADOW } from '../theme/clay';

/**
 * Codice a caselle (REG-812, codice di invito della registrazione): una
 * casella per carattere, stesso «incavo» clay dei campi. Sotto c'è un solo
 * campo vero e invisibile: tastiera, incolla e cancella sono quelli di sistema.
 * La casella dove si sta scrivendo ha il bordo nero.
 */
export const CodeBoxes = forwardRef<
  TextInput,
  {
    value: string;
    onChange: (value: string) => void;
    length?: number;
    focused?: boolean;
    onFocusChange?: (focused: boolean) => void;
    onSubmit?: () => void;
    editable?: boolean;
    testID?: string;
  }
>(function CodeBoxes({ value, onChange, length = 6, focused, onFocusChange, onSubmit, editable = true, testID }, ref) {
  const chars = value.slice(0, length).split('');
  const active = focused ? Math.min(chars.length, length - 1) : -1;
  return (
    <Pressable
      style={s.row}
      onPress={() => (ref as React.RefObject<TextInput | null>)?.current?.focus()}
      accessible={false}
    >
      {Array.from({ length }, (_, i) => (
        <View key={i} style={[s.box, CLAY_SHADOW.sink, i === active && s.boxActive]}>
          <Text style={s.char}>{chars[i] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, length))}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        onSubmitEditing={onSubmit}
        editable={editable}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="oneTimeCode"
        keyboardType="default"
        returnKeyType="done"
        maxLength={length}
        caretHidden
        style={s.input}
        accessibilityLabel="Codice di invito"
        testID={testID}
      />
    </Pressable>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxActive: { borderColor: CLAY.ink },
  char: { fontSize: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: 0 },
  // Sopra le caselle, invisibile: prende il tocco e la tastiera.
  input: { ...StyleSheet.absoluteFillObject, opacity: 0.011, color: 'transparent' },
});
