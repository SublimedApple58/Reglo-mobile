import React from 'react';
import { Platform, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * SF Symbol nativo (via `@expo/ui/swift-ui`: in package.json da feb. 2026,
 * quindi in tutti i binari dalla 2.1.0, 2.4.0 compresa) con ripiego su un'icona
 * Material dove il modulo non disegna (Android, iOS < 17).
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
/** SwiftUI di `@expo/ui` se il modulo nativo disegna qui, altrimenti `null`. */
export const SWIFT_UI = loadSwiftUI();

export function SFSymbol({
  name,
  size,
  color,
  fallback,
}: {
  name: string;
  size: number;
  color: string;
  fallback: React.ComponentProps<typeof MaterialIcons>['name'];
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
  return <MaterialIcons name={fallback} size={size + 3} color={color} />;
}
