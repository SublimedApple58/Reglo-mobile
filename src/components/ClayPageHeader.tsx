import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ClayIconButton } from './clay';
import { CLAY } from '../theme/clay';

/**
 * Testata delle schermate intere clay (REG-639, tab «Tu» e sottosezioni):
 * riga comandi in alto (indietro a sinistra, azioni a destra, tutti
 * `ClayIconButton`), poi il titolo grande 32/600 e una riga grigia di
 * contesto. Stesso titolo dell'Agenda (`IstruttoreHomeScreen`, stili `hd`).
 * Va dentro lo scroll (scorre col contenuto), sotto la safe area.
 */
export function ClayPageHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  subtitle?: string | null;
  /** Se c'è, a sinistra compare l'indietro clay. */
  onBack?: () => void;
  /** A destra (es. `ClayIconButton icon="add"`). */
  actions?: React.ReactNode;
}) {
  const hasBar = !!onBack || !!actions;
  return (
    <View style={s.wrap}>
      {hasBar ? (
        <View style={s.bar}>
          {onBack ? (
            <ClayIconButton icon="back" onPress={onBack} accessibilityLabel="Indietro" testID="page-back" />
          ) : (
            <View />
          )}
          {actions ? <View style={s.actions}>{actions}</View> : null}
        </View>
      ) : null}
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  subtitle: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, marginTop: 2 },
});
