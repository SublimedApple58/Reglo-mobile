import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SWIFT_UI } from './SFSymbol';
import { ClaySegmented } from './clay';

/**
 * Segmentato NATIVO di iOS via `@expo/ui` (SwiftUI, già nel binario 2.4.0:
 * va in OTA), sottile e a tutta larghezza, massimo tre voci (design-system
 * §0.7). Dove SwiftUI non c'è (Android, iOS < 17) il segmentato clay.
 * Usato in testa all'Agenda del titolare-istruttore: «La mia · Tutti» (REG-794).
 */
export function NativeSegmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  if (!SWIFT_UI) {
    return <ClaySegmented options={options} value={value} onChange={onChange} testID={testID} />;
  }
  const { Host, Picker } = SWIFT_UI;
  return (
    <View testID={testID}>
      <Host matchContents={{ vertical: true }} style={s.host}>
        <Picker
          variant="segmented"
          options={options.map((o) => o.label)}
          selectedIndex={Math.max(0, options.findIndex((o) => o.value === value))}
          onOptionSelected={({ nativeEvent }) => {
            const next = options[nativeEvent.index];
            if (next && next.value !== value) onChange(next.value);
          }}
        />
      </Host>
    </View>
  );
}

const s = StyleSheet.create({
  host: { alignSelf: 'stretch' },
});
