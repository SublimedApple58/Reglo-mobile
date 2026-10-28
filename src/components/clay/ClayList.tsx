import React from 'react';
import { ImageSourcePropType, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CLAY } from '../../theme/clay';
import type { Icon3DName } from '../../theme/icons3d';
import { ClaySurface } from './ClaySurface';
import { Icon3D } from './Icon3D';

/**
 * Lista clay (§0): UNA superficie in rilievo che contiene le righe (l'ombra
 * sta sul contenitore, mai sulle righe). I separatori li mette la lista.
 */
export function ClayList({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <ClaySurface padded={false} style={[s.list, style]}>
      {rows.map((row, i) =>
        React.isValidElement<{ divider?: boolean }>(row) ? React.cloneElement(row, { divider: i > 0 }) : row,
      )}
    </ClaySurface>
  );
}

/**
 * Riga di lista: volto/icona a sinistra, titolo, sottotitolo con eventuale
 * icona 3D del motivo (agenda, esame, fermo…), chevron se premibile.
 */
export function ClayListRow({
  leading,
  title,
  subtitle,
  subtitleIcon,
  trailing,
  onPress,
  chevron,
  divider,
  testID,
}: {
  leading?: React.ReactNode;
  title: string;
  /** Testo, oppure un nodo proprio (es. numeri con glifi). */
  subtitle?: React.ReactNode;
  subtitleIcon?: Icon3DName | ImageSourcePropType;
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Di default c'è se la riga è premibile. */
  chevron?: boolean;
  /** Lo imposta `ClayList`. */
  divider?: boolean;
  testID?: string;
}) {
  const showChevron = chevron ?? !!onPress;
  const body = (
    <>
      {divider ? <View style={[s.divider, { left: leading ? 78 : 18 }]} /> : null}
      {leading}
      <View style={s.main}>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && typeof subtitle !== 'string' ? (
          <View style={s.subRow}>{subtitle}</View>
        ) : subtitle ? (
          <View style={s.subRow}>
            {subtitleIcon ? (
              typeof subtitleIcon === 'string' ? (
                <Icon3D name={subtitleIcon as Icon3DName} size={17} />
              ) : (
                <Icon3D source={subtitleIcon} size={17} />
              )
            ) : null}
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
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={typeof subtitle === 'string' ? `${title}, ${subtitle}` : title}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

const s = StyleSheet.create({
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 18 },
  pressed: { backgroundColor: 'rgba(17,17,17,0.03)' },
  divider: { position: 'absolute', top: 0, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  sub: { flexShrink: 1, fontSize: 13.5, color: CLAY.ink3 },
});
