import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { CLAY_EXAM } from '../../theme/clay';

/**
 * R4 Road Exam — CTA nel viola scuro dell'esame (anteprime approvate il
 * 10/11/2026): «Avvia Road Exam» nel foglio esame e «Termina registrazione»
 * nel pannello in guida (variante B). Stesso volume e stessa pressione delle
 * CTA clay nere, spinner al posto del testo mentre attende.
 */
export function ExamCta({
  title,
  onPress,
  loading,
  height = 54,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading }}
      testID={testID}
      style={({ pressed }) => [s.cta, { height, borderRadius: height / 2 }, pressed && s.pressed, style]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.tx}>{title}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CLAY_EXAM.ink,
    boxShadow: '0px 10px 20px -8px rgba(46,16,101,0.5), inset 0px 1px 0px rgba(255,255,255,0.18), inset 0px -4px 2px rgba(0,0,0,0.35)',
  },
  pressed: { transform: [{ scale: 0.97 }], boxShadow: '0px 2px 6px -2px rgba(46,16,101,0.4), inset 0px 2px 6px rgba(0,0,0,0.45)' },
  tx: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
