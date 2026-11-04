import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

/**
 * REG-722: la linea agganciata alle strade viene dai dati di OpenStreetMap
 * (licenza ODbL): l'attribuzione resta visibile dove la si disegna. Testo
 * piccolo e grigio, senza tocchi.
 */
export function OsmCredit({ night = false, style }: { night?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Text pointerEvents="none" style={[styles.text, night && styles.night, style]} accessibilityLabel="Strade © OpenStreetMap">
      © OpenStreetMap
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 10, fontWeight: '500', color: 'rgba(17,17,17,0.45)', letterSpacing: 0.1 },
  night: { color: 'rgba(255,255,255,0.55)' },
});
