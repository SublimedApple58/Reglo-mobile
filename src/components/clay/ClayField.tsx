import React, { forwardRef } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { SHEET_NIGHT, SHEET_NIGHT_SHADOW, useSheetNight } from '../../theme/night';

/**
 * Campo di testo clay (§0.5): etichetta sopra (15/500), campo incavato bianco
 * (`sink`) con raggio 16, nota o errore sotto. `multiline` cresce col testo.
 */
export const ClayField = forwardRef<TextInput, TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
}>(function ClayField({ label, hint, error, style, multiline, ...input }, ref) {
  // Ricca 7: dentro i fogli di Road di notte il campo è scuro.
  const night = useSheetNight();
  return (
    <View style={[s.wrap, style]}>
      {label ? <Text style={[s.label, night && n.ink]}>{label}</Text> : null}
      <View style={[s.box, multiline && s.boxMulti, night ? [n.box, SHEET_NIGHT_SHADOW.sink] : CLAY_SHADOW.sink]}>
        <TextInput
          ref={ref}
          placeholderTextColor={night ? SHEET_NIGHT.ink4 : CLAY.ink4}
          keyboardAppearance={night ? 'dark' : 'default'}
          multiline={multiline}
          {...input}
          style={[s.input, multiline && s.inputMulti, night && n.ink]}
        />
      </View>
      {error ? <Text style={[s.hint, s.error]}>{error}</Text> : hint ? <Text style={[s.hint, night && n.ink3]}>{hint}</Text> : null}
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 15, fontWeight: '500', color: CLAY.ink, paddingHorizontal: 2 },
  box: { minHeight: 50, borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 16, justifyContent: 'center' },
  boxMulti: { paddingVertical: 12 },
  input: { fontSize: 16.5, color: CLAY.ink, letterSpacing: -0.2, paddingVertical: 12 },
  inputMulti: { minHeight: 72, paddingVertical: 0, textAlignVertical: 'top' },
  hint: { fontSize: 13, color: CLAY.ink3, paddingHorizontal: 4 },
  error: { color: '#C13515' },
});

const n = StyleSheet.create({
  box: { backgroundColor: SHEET_NIGHT.surface },
  ink: { color: SHEET_NIGHT.ink },
  ink3: { color: SHEET_NIGHT.ink3 },
});
