import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SWIFT_UI } from './SFSymbol';
import { ClayIconButton } from './clay';
import { CLAY, CLAY_SHADOW } from '../theme/clay';

/**
 * Filtri nativi di Pagamenti (REG-639, giro pagamenti: due alternative alla
 * riga «Mostra», da far scegliere a Tiziano). Entrambe via `@expo/ui`
 * (SwiftUI, già nel binario 2.4.0): niente build nativa. Dove SwiftUI non
 * disegna (Android, iOS < 17) si ripiega sul picker condiviso a spunta.
 */

type Option<T extends string> = { value: T; label: string; count: number };

// Modificatori SwiftUI: modulo JS puro, si carica solo se SwiftUI c'è.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MOD: typeof import('@expo/ui/swift-ui/modifiers') | null = SWIFT_UI ? require('@expo/ui/swift-ui/modifiers') : null;

const BTN = 40;

/**
 * (A) Bottone tondo nella testata del foglio, accanto alla X: apre il menu
 * nativo iOS (pull-down) con la spunta sulla voce attiva e il conteggio.
 * Con un filtro attivo il bottone diventa nero: si vede che la lista è
 * ristretta anche senza leggere la riga sotto il numero.
 */
export function PaymentsFilterMenu<T extends string>({
  options,
  value,
  onChange,
  onFallback,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Senza SwiftUI: apre il picker condiviso. */
  onFallback: () => void;
}) {
  const filtered = value !== options[0]?.value;
  if (!SWIFT_UI || !MOD) {
    return <ClayIconButton icon={<FallbackGlyph />} onPress={onFallback} accessibilityLabel="Filtra le guide" testID="payments-filter" />;
  }
  const { Host, ContextMenu, Picker, Image } = SWIFT_UI;
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <View style={[s.btn, CLAY_SHADOW.raiseSm, filtered && s.btnOn]} testID="payments-filter" accessibilityLabel="Filtra le guide">
      <Host style={s.host}>
        <ContextMenu activationMethod="singlePress">
          <ContextMenu.Items>
            <Picker
              variant="inline"
              options={options.map((o) => `${o.label} · ${o.count}`)}
              selectedIndex={selectedIndex}
              onOptionSelected={({ nativeEvent }) => {
                const next = options[nativeEvent.index];
                if (next) onChange(next.value);
              }}
            />
          </ContextMenu.Items>
          <ContextMenu.Trigger>
            <Image
              systemName="line.3.horizontal.decrease"
              size={16}
              color={filtered ? '#FFFFFF' : CLAY.ink}
              modifiers={[
                MOD.frame({ width: BTN, height: BTN }),
                MOD.background(filtered ? CLAY.ink : '#FFFFFF'),
                MOD.clipShape('circle'),
              ]}
            />
          </ContextMenu.Trigger>
        </ContextMenu>
      </Host>
    </View>
  );
}

/**
 * (B) Controllo segmentato nativo iOS, sottile, a tutta larghezza: al massimo
 * tre voci che ci stanno.
 */
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

function FallbackGlyph() {
  // Ionicons non ha il filtro a tre righe di iOS: «options» è il più vicino.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Ionicons } = require('@expo/vector-icons');
  return <Ionicons name="options-outline" size={19} color={CLAY.ink} />;
}

const s = StyleSheet.create({
  btn: { width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: CLAY.surface },
  btnOn: { backgroundColor: CLAY.ink },
  host: { width: BTN, height: BTN },
  segHost: { alignSelf: 'stretch' },
});
