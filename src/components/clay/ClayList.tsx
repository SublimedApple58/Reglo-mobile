import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CLAY } from '../../theme/clay';
import { CLAY_RADIUS } from '../../theme/spacing';
import { ClaySurface } from './ClaySurface';

/** Margine verticale interno della lista (le righe partono 4 pt sotto il bordo). */
const LIST_INSET = 4;

/** Posizione della riga nella lista: la passa `ClayList` a ogni figlio. */
export type ClayRowPosition = { divider?: boolean; first?: boolean; last?: boolean };

/**
 * Forma dell'evidenziazione al tocco di una riga di `ClayList`: la prima e
 * l'ultima riga seguono gli angoli della card (raggio concentrico, 28 − 4),
 * così la pressione non disegna mai un rettangolo dentro una card tonda.
 */
export function clayRowPressShape({ first, last }: ClayRowPosition): ViewStyle {
  const r = CLAY_RADIUS.card - LIST_INSET;
  return {
    borderTopLeftRadius: first ? r : 0,
    borderTopRightRadius: first ? r : 0,
    borderBottomLeftRadius: last ? r : 0,
    borderBottomRightRadius: last ? r : 0,
  };
}

/** Fondo della riga premuta (sempre con `clayRowPressShape`). */
export const CLAY_ROW_PRESSED: ViewStyle = { backgroundColor: 'rgba(17,17,17,0.035)' };

/**
 * Lista clay (§0): UNA superficie in rilievo che contiene le righe (l'ombra
 * sta sul contenitore, mai sulle righe). I separatori li mette la lista.
 */
export function ClayList({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <ClaySurface padded={false} style={[s.list, style]}>
      {rows.map((row, i) =>
        React.isValidElement<ClayRowPosition>(row)
          ? React.cloneElement(row, { divider: i > 0, first: i === 0, last: i === rows.length - 1 })
          : row,
      )}
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
      <View style={s.row} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={dimmed}
      style={({ pressed }) => [s.row, pressed && [CLAY_ROW_PRESSED, clayRowPressShape({ first, last })]]}
      accessibilityRole="button"
      accessibilityLabel={typeof subtitle === 'string' ? `${title}, ${subtitle}` : title}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

const s = StyleSheet.create({
  list: { paddingVertical: LIST_INSET },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 18 },
  divider: { position: 'absolute', top: 0, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  main: { flex: 1, minWidth: 0 },
  dim: { opacity: 0.45 },
  title: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  sub: { flexShrink: 1, fontSize: 13.5, color: CLAY.ink3 },
});
