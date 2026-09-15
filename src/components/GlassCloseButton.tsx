import React from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * X di chiusura "liquid glass" nativa di iOS 26 per page sheet e form sheet.
 *
 * Usa `@expo/ui/swift-ui` (modulo nativo ExpoUI già presente nei binari 2.2.0 e
 * 2.3.0, compilati con SDK iOS 26.2): SF Symbol `xmark` dentro un `glassEffect`
 * circolare interattivo, lo stesso materiale dei bottoni di sistema.
 *
 * Si attiva solo su iOS 26+ con il modulo presente. Altrove (Android, iOS < 26)
 * mostra `children`, cioè la X originale dello sheet, così il look resta quello
 * di sempre; senza children usa la X tonda grigia standard.
 */

const IOS_MAJOR = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;

type SwiftUI = typeof import('@expo/ui/swift-ui');
type SwiftUIModifiers = typeof import('@expo/ui/swift-ui/modifiers');

function loadSwiftUI(): { ui: SwiftUI; mod: SwiftUIModifiers } | null {
  if (IOS_MAJOR < 26) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoUI')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { ui: require('@expo/ui/swift-ui'), mod: require('@expo/ui/swift-ui/modifiers') };
  } catch {
    return null;
  }
}

const SWIFT_UI = loadSwiftUI();
const SIZE = 44;

/** true se la X glass viene davvero disegnata (iOS 26+ con ExpoUI). */
export const HAS_GLASS_CLOSE = SWIFT_UI !== null;

export function GlassCloseButton({
  onPress,
  disabled = false,
  accessibilityLabel = 'Chiudi',
  testID,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Solo per la X glass: posizionamento (es. assoluto) che la X originale aveva nel suo stile. */
  style?: StyleProp<ViewStyle>;
  /** X originale da mostrare dove la glass non c'è (Android, iOS < 26). */
  children?: React.ReactNode;
}) {
  if (SWIFT_UI) {
    const { Host, Image } = SWIFT_UI.ui;
    const { accessibilityLabel: a11yLabel, frame, glassEffect, onTapGesture } = SWIFT_UI.mod;
    return (
      <View style={[s.glassWrap, style, disabled && s.disabled]} testID={testID} pointerEvents={disabled ? 'none' : 'auto'}>
        <Host matchContents style={s.host}>
          <Image
            systemName="xmark"
            size={22}
            color="#1A1A2E"
            modifiers={[
              frame({ width: SIZE, height: SIZE }),
              glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
              onTapGesture(() => {
                if (!disabled) onPress();
              }),
              a11yLabel(accessibilityLabel),
            ]}
          />
        </Host>
      </View>
    );
  }

  if (children) return <>{children}</>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [s.fallback, pressed && { opacity: 0.5 }]}
    >
      <Ionicons name="close" size={22} color="#64748B" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  // 44pt come i bottoni di sistema. Tutte le X degli sheet stanno a destra: il
  // margine negativo tiene il bordo destro dove stava la X di prima (34pt) e non
  // alza header e top bar; il cerchio in più cresce verso sinistra.
  glassWrap: { width: SIZE, height: SIZE, marginVertical: -5, marginLeft: -10 },
  host: { width: SIZE, height: SIZE },
  disabled: { opacity: 0.4 },
  fallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
