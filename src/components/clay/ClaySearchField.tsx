import React from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { FIELD_HEIGHT } from '../../theme/spacing';

/** Campo di ricerca clay (§0): capsula incavata sul bianco (`sink`), lente monocromatica. */
export function ClaySearchField({ style, ...input }: TextInputProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.wrap, CLAY_SHADOW.sink, style]}>
      <Ionicons name="search" size={17} color={CLAY.ink3} />
      <TextInput
        placeholderTextColor={CLAY.ink4}
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        {...input}
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: FIELD_HEIGHT,
    borderRadius: FIELD_HEIGHT / 2,
    backgroundColor: CLAY.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 16,
    paddingRight: 10,
  },
  input: { flex: 1, height: FIELD_HEIGHT, fontSize: 16.5, color: CLAY.ink, letterSpacing: -0.2 },
});
