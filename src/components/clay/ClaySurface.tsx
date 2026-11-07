import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { CLAY_RADIUS } from '../../theme/spacing';
import { ClayPressable } from './ClayPressable';
import { SHEET_NIGHT, SHEET_NIGHT_SHADOW, useSheetNight } from '../../theme/night';

/**
 * Superficie clay (§0): bianco in rilievo, raggio card. È la card dell'app.
 * Con `onPress` diventa premibile (scala, senza rimbalzo). Se il contenuto
 * deve essere ritagliato (foto, mappa) metti `overflow: 'hidden'` su un
 * figlio, non qui: taglierebbe l'ombra.
 */
export function ClaySurface({
  children,
  onPress,
  radius = CLAY_RADIUS.card,
  padded = true,
  size = 'md',
  style,
  testID,
  accessibilityLabel,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
  radius?: number;
  /** Padding 20 (card) oppure nessuno (liste, contenuti a filo). */
  padded?: boolean;
  /** `sm` = ombra degli elementi piccoli (`raiseSm`). */
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  // Ricca 7: dentro i fogli di Road di notte la card è grigio scuro.
  const night = useSheetNight();
  const st = [
    s.base,
    { borderRadius: radius },
    padded && s.padded,
    night ? [s.night, SHEET_NIGHT_SHADOW.raise] : size === 'sm' ? CLAY_SHADOW.raiseSm : CLAY_SHADOW.raise,
    style,
  ];
  if (onPress) {
    return (
      <ClayPressable kind="card" onPress={onPress} style={st} testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {children}
      </ClayPressable>
    );
  }
  return (
    <View style={st} testID={testID}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: { backgroundColor: CLAY.surface },
  padded: { padding: 20 },
  night: { backgroundColor: SHEET_NIGHT.surface },
});
