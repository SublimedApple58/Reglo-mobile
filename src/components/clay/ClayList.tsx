import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CLAY } from '../../theme/clay';
import { CLAY_RADIUS } from '../../theme/spacing';
import { ClaySurface } from './ClaySurface';

/** Respiro in più sopra la prima riga e sotto l'ultima (dentro la riga, così
 *  anche l'evidenziazione al tocco arriva fino al bordo della card). */
const LIST_INSET = 4;

/** Posizione della riga nella lista: la passa `ClayList` a ogni figlio. */
export type ClayRowPosition = { divider?: boolean; first?: boolean; last?: boolean };

/**
 * Padding verticale di una riga di `ClayList` (`base` = quello normale): la
 * prima e l'ultima riga prendono il respiro della lista al loro interno, così
 * premute si evidenziano fino al bordo della card. Gli angoli tondi li dà il
 * ritaglio della lista (REG-639: prima l'evidenziazione era un rettangolo).
 */
export function clayRowPadding({ first, last }: ClayRowPosition, base: number): ViewStyle {
  return { paddingTop: base + (first ? LIST_INSET : 0), paddingBottom: base + (last ? LIST_INSET : 0) };
}

/**
 * Le righe che applicano `clayRowPadding` lo dichiarano con
 * `markClayRow(Componente)`: la lista non aggiunge loro altro respiro.
 */
const ROW_AWARE = new WeakSet<object>();
export function markClayRow<T extends object>(component: T): T {
  ROW_AWARE.add(component);
  return component;
}
const isRowAware = (type: unknown) => typeof type !== 'string' && !!type && ROW_AWARE.has(type as object);

/** Fondo della riga premuta: a tutta larghezza, la lista lo ritaglia tondo. */
export const CLAY_ROW_PRESSED: ViewStyle = { backgroundColor: 'rgba(17,17,17,0.045)' };

/**
 * Lista clay (§0): UNA superficie in rilievo che contiene le righe (l'ombra
 * sta sul contenitore, mai sulle righe). I separatori li mette la lista.
 * Le righe stanno in un figlio che ritaglia con il raggio della card: la
 * pressione di una riga combacia con la card, angoli compresi; l'ombra resta
 * fuori dal ritaglio (§0.3).
 */
export function ClayList({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <ClaySurface padded={false} style={style}>
      <View style={s.clip}>
        {rows.map((row, i) => {
          if (!React.isValidElement<ClayRowPosition>(row)) return row;
          const first = i === 0;
          const last = i === rows.length - 1;
          const el = React.cloneElement(row, { divider: i > 0, first, last });
          // Righe che non usano `clayRowPadding`: il respiro glielo dà la lista.
          if (isRowAware(row.type) || (!first && !last)) return el;
          return (
            <View key={row.key} style={{ paddingTop: first ? LIST_INSET : 0, paddingBottom: last ? LIST_INSET : 0 }}>
              {el}
            </View>
          );
        })}
      </View>
    </ClaySurface>
  );
}

/**
 * Riga di lista: volto/icona a sinistra, titolo, sottotitolo (solo testo, §0.4),
 * chevron se premibile.
 */
export function ClayListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron,
  dimmed,
  divider,
  first,
  last,
  testID,
}: {
  leading?: React.ReactNode;
  title: string;
  /** Testo, oppure un nodo proprio (es. numeri con glifi). */
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Di default c'è se la riga è premibile. */
  chevron?: boolean;
  /** Riga non disponibile (es. auto occupata): tutto più tenue. */
  dimmed?: boolean;
  /** Li imposta `ClayList`. */
  divider?: boolean;
  first?: boolean;
  last?: boolean;
  testID?: string;
}) {
  const showChevron = chevron ?? !!onPress;
  const body = (
    <>
      {divider ? <View style={[s.divider, { left: leading ? 78 : 18 }]} /> : null}
      {leading ? <View style={dimmed && s.dim}>{leading}</View> : null}
      <View style={[s.main, dimmed && s.dim]}>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && typeof subtitle !== 'string' ? (
          <View style={s.subRow}>{subtitle}</View>
        ) : subtitle ? (
          <View style={s.subRow}>
            <Text style={s.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[s.row, clayRowPadding({ first, last }, ROW_PAD)]} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={dimmed}
      style={({ pressed }) => [s.row, clayRowPadding({ first, last }, ROW_PAD), pressed && CLAY_ROW_PRESSED]}
      accessibilityRole="button"
      accessibilityLabel={typeof subtitle === 'string' ? `${title}, ${subtitle}` : title}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

const ROW_PAD = 12;

const s = StyleSheet.create({
  clip: { borderRadius: CLAY_RADIUS.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  // 0.5 e non hairlineWidth (1/3 pt): un filo da 1 px fisico in posizione
  // assoluta a y frazionaria spariva (giro pagamenti 28/10, picker e storico).
  divider: { position: 'absolute', top: 0, right: 18, height: 0.5, backgroundColor: 'rgba(17,17,17,0.12)' },
  main: { flex: 1, minWidth: 0 },
  dim: { opacity: 0.45 },
  title: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  sub: { flexShrink: 1, fontSize: 13.5, color: CLAY.ink3 },
});

markClayRow(ClayListRow);
