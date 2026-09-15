import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * X di chiusura "liquid glass" nativa di iOS 26 (SPERIMENTALE, per ora solo sul
 * form sheet "Aggiungi" della home istruttore).
 *
 * Usa `@expo/ui/swift-ui` (modulo nativo ExpoUI già presente nei binari 2.2.0 e
 * 2.3.0, compilati con SDK iOS 26.2): un'icona SF Symbol `xmark` dentro un
 * `glassEffect` circolare interattivo, cioè lo stesso materiale dei bottoni di
 * sistema. Il modulo si carica in modo lazy e solo su iOS 26+; altrove (Android,
 * iOS < 26, binario senza il modulo) resta la X tonda grigia di prima.
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

export function GlassCloseButton({
  onPress,
  accessibilityLabel = 'Chiudi',
  testID,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  if (SWIFT_UI) {
    const { Host, Image } = SWIFT_UI.ui;
    const { accessibilityLabel: a11yLabel, frame, glassEffect, onTapGesture } = SWIFT_UI.mod;
    return (
      <View style={s.glassWrap} testID={testID}>
        <Host matchContents style={s.host}>
          <Image
            systemName="xmark"
            size={17}
            color="#1A1A2E"
            modifiers={[
              frame({ width: SIZE, height: SIZE }),
              glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
              onTapGesture(onPress),
              a11yLabel(accessibilityLabel),
            ]}
          />
        </Host>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
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
  // 44pt come i bottoni di sistema, ma senza alzare l'header (la X di prima era 34).
  glassWrap: { width: SIZE, height: SIZE, marginVertical: -5, marginRight: -5 },
  host: { width: SIZE, height: SIZE },
  fallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
