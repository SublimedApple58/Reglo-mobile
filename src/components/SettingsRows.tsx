import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CLAY_ROW_PRESSED, ClayPressable, ClayToggle, clayRowPadding, markClayRow } from './clay';
import type { ClayRowPosition } from './clay';
import { CLAY, CLAY_SHADOW } from '../theme/clay';

/**
 * Righe da Impostazioni iOS dentro una `ClayList` (REG-639, giro dopo la prova
 * sull'iPhone): niente chip né pillole a griglia. Interruttore, valore a destra
 * con chevron (apre un picker), spunta (scelta da lista) e stepper per i numeri.
 * Il sottotitolo va a capo: è una spiegazione, non un'etichetta.
 */

const PAD = 14;

function Shell({
  children,
  onPress,
  divider,
  first,
  last,
  testID,
  accessibilityLabel,
  selected,
}: ClayRowPosition & {
  children: React.ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  selected?: boolean;
}) {
  const inner = (
    <>
      {divider ? <View style={s.divider} /> : null}
      {children}
    </>
  );
  if (!onPress) {
    return (
      <View style={[s.row, clayRowPadding({ first, last }, PAD)]} testID={testID}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, clayRowPadding({ first, last }, PAD), pressed && CLAY_ROW_PRESSED]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      testID={testID}
    >
      {inner}
    </Pressable>
  );
}

function Label({ title, subtitle, subtitleColor, oneLine }: { title: string; subtitle?: string | null; subtitleColor?: string | null; oneLine?: boolean }) {
  return (
    <View style={s.main}>
      <Text style={s.title} numberOfLines={oneLine ? 1 : undefined}>{title}</Text>
      {subtitle ? (
        <Text style={[s.sub, subtitleColor ? { color: subtitleColor } : null]} numberOfLines={oneLine ? 1 : undefined}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Interruttore: la riga non si preme, si preme il toggle. */
export const SettingToggleRow = markClayRow(function SettingToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  testID,
  ...pos
}: ClayRowPosition & { title: string; subtitle?: string | null; value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  return (
    <Shell {...pos} testID={testID}>
      <Label title={title} subtitle={subtitle} />
      <ClayToggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </Shell>
  );
});

/** Valore a destra + chevron: apre un picker (lista o orario). */
export const SettingValueRow = markClayRow(function SettingValueRow({
  title,
  subtitle,
  value,
  onPress,
  testID,
  ...pos
}: ClayRowPosition & { title: string; subtitle?: string | null; value: string; onPress: () => void; testID?: string }) {
  return (
    <Shell {...pos} onPress={onPress} testID={testID} accessibilityLabel={`${title}, ${value}`}>
      <Label title={title} subtitle={subtitle} />
      <Text style={s.value} numberOfLines={1}>
        {value}
      </Text>
      <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} />
    </Shell>
  );
});

/**
 * Voce di una scelta: spunta nera a destra quando è scelta (come Impostazioni
 * iOS). La usano anche il picker condiviso e «Allievi del gruppo»: volto a
 * sinistra con `leading`, al posto della spunta un nodo con `trailing`.
 */
export const SettingCheckRow = markClayRow(function SettingCheckRow({
  title,
  subtitle,
  subtitleColor,
  leading,
  trailing,
  oneLine,
  checked,
  onPress,
  testID,
  ...pos
}: ClayRowPosition & {
  title: string;
  subtitle?: string | null;
  subtitleColor?: string | null;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  oneLine?: boolean;
  checked: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Shell
      {...pos}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      selected={checked}
      testID={testID}
      accessibilityLabel={title}
    >
      {leading}
      <Label title={title} subtitle={subtitle} subtitleColor={subtitleColor} oneLine={oneLine} />
      {trailing ?? <View style={s.check}>{checked ? <Ionicons name="checkmark" size={21} color={CLAY.ink} /> : null}</View>}
    </Shell>
  );
});

/** Numero con − e + (tondi clay), come lo stepper di iOS. */
export const SettingStepperRow = markClayRow(function SettingStepperRow({
  title,
  subtitle,
  value,
  min,
  max,
  onChange,
  format,
  testID,
  ...pos
}: ClayRowPosition & {
  title: string;
  subtitle?: string | null;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** Come si legge il valore (es. un indice di durate → «1 h»). */
  format?: (v: number) => string;
  testID?: string;
}) {
  const step = (d: number) => {
    const next = Math.min(max, Math.max(min, value + d));
    if (next === value) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };
  return (
    <Shell {...pos} testID={testID}>
      <Label title={title} subtitle={subtitle} />
      <View style={s.stepper}>
        <StepButton glyph="remove" disabled={value <= min} onPress={() => step(-1)} label={`Meno, ${title}`} />
        <Text style={s.stepValue} accessibilityLiveRegion="polite">
          {format ? format(value) : value}
        </Text>
        <StepButton glyph="add" disabled={value >= max} onPress={() => step(1)} label={`Più, ${title}`} />
      </View>
    </Shell>
  );
});

function StepButton({ glyph, disabled, onPress, label }: { glyph: 'add' | 'remove'; disabled: boolean; onPress: () => void; label: string }) {
  return (
    <ClayPressable
      kind="small"
      onPress={disabled ? undefined : onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[s.stepBtn, CLAY_SHADOW.raiseSm, disabled && s.stepOff]}
    >
      <Ionicons name={glyph} size={18} color={CLAY.ink} />
    </ClayPressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, minHeight: 56 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: 0.5, backgroundColor: 'rgba(17,17,17,0.12)' },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  sub: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3, marginTop: 2 },
  value: { fontSize: 16, color: CLAY.ink3, letterSpacing: -0.2, maxWidth: '55%' },
  check: { width: 22, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: CLAY.surface, alignItems: 'center', justifyContent: 'center' },
  stepOff: { opacity: 0.35 },
  stepValue: { minWidth: 22, textAlign: 'center', fontSize: 18, fontWeight: '600', color: CLAY.ink, fontVariant: ['tabular-nums'] },
});
