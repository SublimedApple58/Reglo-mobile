import React from 'react';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * SF Symbol nativo (via `@expo/ui/swift-ui`, già nei binari 2.2.0+) con
 * ripiego su un'icona Ionicons dove il modulo non c'è (Android, binari vecchi).
 * Solo disegno: i tocchi li gestisce il contenitore (pointerEvents none).
 */
const IOS_MAJOR = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;

type SwiftUI = typeof import('@expo/ui/swift-ui');
function loadSwiftUI(): SwiftUI | null {
  if (IOS_MAJOR < 17) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoUI')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@expo/ui/swift-ui');
  } catch {
    return null;
  }
}
const SWIFT_UI = loadSwiftUI();

export function SFSymbol({
  name,
  size,
  color,
  fallback,
}: {
  name: string;
  size: number;
  color: string;
  fallback: React.ComponentProps<typeof Ionicons>['name'];
}) {
  if (SWIFT_UI) {
    const { Host, Image } = SWIFT_UI;
    return (
      <View pointerEvents="none">
        <Host matchContents>
          <Image systemName={name as never} size={size} color={color} />
        </Host>
      </View>
    );
  }
  return <Ionicons name={fallback} size={size + 2} color={color} />;
}
