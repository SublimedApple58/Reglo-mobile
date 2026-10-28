import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { ClayPressable } from './ClayPressable';

const GLYPH = { close: 'close', back: 'chevron-back', add: 'add' } as const;

/**
 * Bottone icona tondo clay (§0): cerchio bianco in rilievo (`raiseSm`), o
 * nero (`tone="ink"`). Glifo monocromatico: X, indietro, +, oppure un nodo
 * proprio (es. SF Symbol «centra»). 40 di default, 50 con `size="lg"`.
 */
export function ClayIconButton({
  icon,
  onPress,
  size = 'md',
  tone = 'light',
  style,
  accessibilityLabel,
  testID,
}: {
  icon: keyof typeof GLYPH | React.ReactNode;
  onPress?: () => void;
  size?: 'md' | 'lg';
  tone?: 'light' | 'ink';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  testID?: string;
}) {
  const d = size === 'lg' ? 50 : 40;
  const color = tone === 'ink' ? '#FFFFFF' : CLAY.ink;
  const glyph =
    typeof icon === 'string' && icon in GLYPH ? (
      <Ionicons name={GLYPH[icon as keyof typeof GLYPH]} size={size === 'lg' ? 24 : 20} color={color} />
    ) : (
      (icon as React.ReactNode)
    );
  return (
    <ClayPressable
      kind="small"
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        s.base,
        { width: d, height: d, borderRadius: d / 2, backgroundColor: tone === 'ink' ? CLAY.ink : CLAY.surface },
        tone === 'ink' ? CLAY_SHADOW.ink : CLAY_SHADOW.raiseSm,
        style,
      ]}
    >
      {glyph}
    </ClayPressable>
  );
}

const s = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
