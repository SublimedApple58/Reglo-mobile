import React, { useState } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CLAY, CLAY_CTA, CLAY_SHADOW } from '../../theme/clay';
import { CTA_HEIGHT, CTA_RADIUS } from '../../theme/spacing';
import { ClayPressable } from './ClayPressable';

/**
 * CTA clay (§0): capsula alta `CTA_HEIGHT`, la più tonda.
 * - `primary`: nero gonfio (`CLAY_CTA.primary`: luce e ombra interne +
 *   ombra esterna), testo bianco; premuta sprofonda (`primaryPressed`).
 * - `secondary`: bianco in rilievo (`raise`), testo nero; premuta sprofonda
 *   (`secondaryPressed`).
 * `compact` = 46 di altezza (CTA dentro card o pannelli).
 * In attesa mostra lo spinner al posto del contenuto, senza cambiare etichetta.
 */
export function ClayButton({
  title,
  onPress,
  variant = 'primary',
  leading,
  loading,
  disabled,
  compact,
  style,
  children,
  testID,
  accessibilityLabel,
  night,
}: {
  /** REG-697 (guida Road di notte): primario chiaro, secondario grigio scuro. */
  night?: boolean;
  title?: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  /** Glifo prima del testo (es. play). */
  leading?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Contenuto libero al posto di `title` (es. testo animato). */
  children?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const primary = variant === 'primary';
  const off = disabled && !loading;
  const height = compact ? 46 : CTA_HEIGHT;
  const volume = off
    ? null
    : primary
      ? pressed
        ? CLAY_CTA.primaryPressed
        : CLAY_CTA.primary
      : pressed
        ? CLAY_CTA.secondaryPressed
        : CLAY_SHADOW.raise;
  const fg = off ? CLAY.ink4 : night ? (primary ? '#111111' : '#F2F2F2') : primary ? '#FFFFFF' : CLAY.ink;
  // Di notte il volume clay (ombre interne scure) sporcherebbe il bottone chiaro: solo l'ombra esterna.
  const nightLook = night && !off ? { backgroundColor: primary ? '#F2F2F2' : '#2C2C2E', ...CLAY_SHADOW.raise } : null;

  return (
    <ClayPressable
      kind="cta"
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
      style={[
        s.base,
        { height, borderRadius: compact ? height / 2 : CTA_RADIUS },
        { backgroundColor: off ? '#F1F1F1' : primary ? CLAY.ink : CLAY.surface },
        nightLook ?? volume,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {leading}
          {children ?? (
            <Text style={[s.tx, compact && s.txCompact, { color: fg }]} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>
      )}
    </ClayPressable>
  );
}

/** Triangolo «play» delle CTA di avvio (bianco su nero). */
export function PlayGlyph({ color = '#FFFFFF' }: { color?: string }) {
  return <View style={[s.play, { borderLeftColor: color }]} />;
}

const s = StyleSheet.create({
  base: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tx: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  txCompact: { fontSize: 15.5 },
  play: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});
