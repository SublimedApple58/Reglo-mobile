import React, { useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { colorPickerStore } from '../../../src/stores/colorPickerStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function ColorPickerScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(colorPickerStore.subscribe, colorPickerStore.get);
  if (!data) return <View style={s.root} />;

  const { title, subtitle, currentHex, swatches, onSelect } = data;
  const norm = (h: string | null) => (h ?? '').toUpperCase();
  const pick = (hex: string | null) => {
    onSelect(hex);
    router.back();
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle ?? 'Scegli un colore o torna a quello standard.'}</Text>
      </View>

      <SheetScaffold>
        {/* Colore standard (reset override) */}
        <Pressable
          onPress={() => pick(null)}
          style={({ pressed }) => [s.stdRow, pressed && { opacity: 0.6 }]}
        >
          <View style={s.stdDot}>
            <Ionicons name="ban-outline" size={18} color="#94A3B8" />
          </View>
          <Text style={s.stdLabel}>Colore standard</Text>
          {currentHex == null ? <Ionicons name="checkmark-circle" size={22} color="#1A1A2E" /> : null}
        </Pressable>

        <View style={s.divider} />

        <View style={s.grid}>
          {swatches.map((sw) => {
            const selected = norm(sw.hex) === norm(currentHex);
            return (
              <Pressable
                key={sw.hex}
                onPress={() => pick(sw.hex)}
                style={({ pressed }) => [s.swatchCell, pressed && { opacity: 0.7 }]}
                accessibilityLabel={sw.name}
              >
                <View style={[s.swatch, { backgroundColor: sw.hex }, selected && s.swatchSelected]}>
                  {selected ? <Ionicons name="checkmark" size={20} color="#FFFFFF" /> : null}
                </View>
                <Text style={s.swatchName} numberOfLines={1}>{sw.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  stdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 52 },
  stdDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F3F7', alignItems: 'center', justifyContent: 'center' },
  stdLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEDF0', marginVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  swatchCell: { width: '25%', alignItems: 'center', gap: 6 },
  swatch: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 3, borderColor: '#1A1A2E' },
  swatchName: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
});
