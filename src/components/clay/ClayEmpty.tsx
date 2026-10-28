import React from 'react';
import { ImageSourcePropType, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CLAY } from '../../theme/clay';
import { Icon3D } from './Icon3D';

/**
 * Stato vuoto (§0.5): un'icona 3D «di morale» (§0.4), titolo e una riga di
 * testo, centrati; eventuale azione sotto. Mai un riquadro grigio.
 */
export function ClayEmpty({
  icon,
  title,
  text,
  action,
  style,
  testID,
}: {
  icon?: ImageSourcePropType;
  title: string;
  text?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={[s.wrap, style]} testID={testID}>
      {icon ? <Icon3D source={icon} size={84} style={s.icon} /> : null}
      <Text style={s.title}>{title}</Text>
      {text ? <Text style={s.text}>{text}</Text> : null}
      {action ? <View style={s.action}>{action}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28 },
  icon: { marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4, textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, textAlign: 'center', marginTop: 6 },
  action: { marginTop: 18, alignSelf: 'stretch' },
});
