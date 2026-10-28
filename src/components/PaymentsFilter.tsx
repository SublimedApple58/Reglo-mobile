import React from 'react';
import { StyleSheet } from 'react-native';
import { SWIFT_UI } from './SFSymbol';

/**
 * Filtro di Pagamenti (REG-639, giro pagamenti; scelto da Tiziano il 28/10):
 * il controllo segmentato NATIVO di iOS via `@expo/ui` (SwiftUI, già nel
 * binario 2.4.0, niente build nativa). Dove SwiftUI non disegna (Android,
 * iOS < 17) si ripiega sul segmentato clay.
 */

type Option<T extends string> = { value: T; label: string; count: number };

/** Segmentato nativo iOS, sottile, a tutta larghezza: al massimo tre voci. */
export function PaymentsFilterSegmented<T extends string>({
  options,
  value,
  onChange,
  fallback,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Senza SwiftUI: il segmentato clay. */
  fallback: React.ReactNode;
}) {
  if (!SWIFT_UI) return <>{fallback}</>;
  const { Host, Picker } = SWIFT_UI;
  return (
    <Host matchContents={{ vertical: true }} style={s.segHost}>
      <Picker
        variant="segmented"
        options={options.map((o) => o.label)}
        selectedIndex={Math.max(0, options.findIndex((o) => o.value === value))}
        onOptionSelected={({ nativeEvent }) => {
          const next = options[nativeEvent.index];
          if (next) onChange(next.value);
        }}
      />
    </Host>
  );
}

const s = StyleSheet.create({
  segHost: { alignSelf: 'stretch' },
});
