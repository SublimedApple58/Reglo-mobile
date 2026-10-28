import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ClayIconButton } from './clay/ClayIconButton';

/**
 * X di chiusura dei page/form sheet costruiti a mano (quelli non ancora su
 * `FormSheet`). Dal clay v2 (REG-639, Tiziano 28/10/2026) è SEMPRE il cerchio
 * bianco in rilievo, identico in tutti i fogli: niente più X «liquid glass»
 * di iOS 26, che cambiava resa da un fondo all'altro.
 *
 * Il nome resta per non toccare le ~40 schermate che la usano; `children`
 * (la vecchia X di ripiego) è ignorato.
 */

/**
 * Storico: valeva true solo su iOS 26 (X glass). Ora la X clay c'è ovunque,
 * quindi anche i fogli che la mostravano solo lì (prenotazione) la hanno sempre.
 */
export const HAS_GLASS_CLOSE = true;

export function GlassCloseButton({
  onPress,
  disabled = false,
  accessibilityLabel = 'Chiudi',
  testID,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Posizionamento (es. assoluto) che la X aveva nel suo stile. */
  style?: StyleProp<ViewStyle>;
  /** @deprecated ignorato dal clay v2. */
  children?: React.ReactNode;
}) {
  return (
    <View style={[s.wrap, style, disabled && s.disabled]} pointerEvents={disabled ? 'none' : 'auto'}>
      <ClayIconButton icon="close" onPress={onPress} accessibilityLabel={accessibilityLabel} testID={testID} />
    </View>
  );
}

const s = StyleSheet.create({
  // Stesso ingombro della X glass di prima (44 con margini negativi): header e
  // top bar non si spostano; il cerchio clay è 40.
  wrap: { width: 44, height: 44, marginVertical: -5, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
