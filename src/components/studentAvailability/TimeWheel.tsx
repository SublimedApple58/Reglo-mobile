import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CLAY } from '../../theme/clay';
import { clock } from '../../utils/studentAvailability';

const ITEM_H = 36;
const VISIBLE = 3;

/**
 * REG-813 — rotella di un orario («Dalle» / «Alle»): la lista scorre e si
 * ferma sempre su un valore, quello al centro è scelto. Se il valore cambia da
 * fuori (l'altra rotella lo trascina per tenere l'intervallo valido) la
 * rotella ci scorre sopra da sola.
 */
export const TimeWheel = memo(function TimeWheel({
  label,
  values,
  value,
  onChange,
  testID,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
  testID?: string;
}) {
  const ref = useRef<ScrollView | null>(null);
  const indexOf = useCallback(
    (v: number) => {
      const i = values.indexOf(v);
      return i < 0 ? 0 : i;
    },
    [values],
  );
  // Riga al centro mentre scorre (solo per il grassetto).
  const [center, setCenter] = useState(() => indexOf(value));
  const settled = useRef(indexOf(value));

  useEffect(() => {
    const i = indexOf(value);
    if (i === settled.current) return;
    settled.current = i;
    setCenter(i);
    ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
  }, [value, indexOf]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.min(values.length - 1, Math.max(0, Math.round(y / ITEM_H)));
    setCenter(i);
    // Rilascio lento: lo snap nativo può non scattare, la riga resterebbe storta.
    if (Math.abs(y - i * ITEM_H) > 0.5) ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
    if (i === settled.current) return;
    settled.current = i;
    onChange(values[i]);
  };

  return (
    <View style={s.col}>
      <Text style={s.label}>{label}</Text>
      <View style={s.window}>
        <View style={s.band} pointerEvents="none" />
        <ScrollView
          ref={ref}
          testID={testID}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: indexOf(value) * ITEM_H }}
          onLayout={() => ref.current?.scrollTo({ y: settled.current * ITEM_H, animated: false })}
          scrollEventThrottle={32}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
            if (i !== center && i >= 0 && i < values.length) setCenter(i);
          }}
          onMomentumScrollEnd={settle}
          onScrollEndDrag={(e) => {
            // Rilascio da fermo: nessuna inerzia, quindi nessun `onMomentumScrollEnd`.
            if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) settle(e);
          }}
          contentContainerStyle={s.content}
        >
          {values.map((v, i) => (
            <Pressable
              key={v}
              style={s.item}
              onPress={() => {
                ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
                setCenter(i);
                if (i !== settled.current) {
                  settled.current = i;
                  onChange(v);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${clock(v)}`}
            >
              <Text style={[s.text, i === center && s.textOn]}>{clock(v)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  col: { flex: 1, alignItems: 'center' },
  label: { fontSize: 12.5, fontWeight: '500', color: CLAY.ink3, marginBottom: 6 },
  window: { height: ITEM_H * VISIBLE, alignSelf: 'stretch' },
  band: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: ITEM_H,
    height: ITEM_H,
    borderRadius: 12,
    backgroundColor: 'rgba(17,17,17,0.05)',
  },
  content: { paddingVertical: ITEM_H },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '500', color: CLAY.ink4, fontVariant: ['tabular-nums'] },
  textOn: { fontSize: 19, fontWeight: '600', color: CLAY.ink },
});
