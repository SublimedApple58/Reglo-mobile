import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CLAY } from '../../theme/clay';

/**
 * Sezione di una schermata o di un foglio (§0.5): titolo di sezione in
 * minuscolo (17/600, mai MAIUSCOLETTO né eyebrow), il contenuto (di solito
 * una `ClayList`) e una nota sotto in grigio. Il titolo può avere un'azione
 * testuale a destra («Modifica»).
 */
export function ClaySection({
  title,
  action,
  footnote,
  children,
  style,
}: {
  title?: string;
  /** Nodo a destra del titolo (es. testo premibile). */
  action?: React.ReactNode;
  footnote?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.wrap, style]}>
      {title || action ? (
        <View style={s.head}>
          {title ? <Text style={s.title} accessibilityRole="header">{title}</Text> : <View />}
          {action}
        </View>
      ) : null}
      {children}
      {footnote ? <Text style={s.foot}>{footnote}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 26 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 2 },
  title: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  foot: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 10, paddingHorizontal: 4 },
});
