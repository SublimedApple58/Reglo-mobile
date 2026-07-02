import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { GradientCTABackground } from '../../../src/components/GradientCTA';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const NAVY = '#1A1A2E';
const INK = '#1E293B';
const MUTED = '#94A3B8';

export default function SelectOptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(optionsPickerStore.subscribe, optionsPickerStore.get);

  const [picked, setPicked] = useState<string[]>(data?.selected ?? []);

  if (!data) return <View style={s.root} />;

  const pickSingle = (value: string) => {
    data.onConfirm([value]);
    router.back();
  };
  const toggleMulti = (value: string) =>
    setPicked((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  const confirmMulti = () => {
    data.onConfirm(picked);
    router.back();
  };

  return (
    <View style={[s.root, { paddingTop: 16, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.topbar}>
        <Text style={s.title} numberOfLines={1}>{data.title}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>

      <View style={s.list}>
        {data.options.map((o, idx) => {
          const on = data.multi ? picked.includes(o.value) : data.selected.includes(o.value);
          return (
            <View key={o.value}>
              {idx > 0 ? <View style={s.divider} /> : null}
              <Pressable
                onPress={() => (data.multi ? toggleMulti(o.value) : pickSingle(o.value))}
                style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}
              >
                {o.leadingInitials ? (
                  <View style={s.avatar}><Text style={s.avatarText}>{o.leadingInitials}</Text></View>
                ) : null}
                <View style={s.body}>
                  <Text style={[s.label, on && { fontWeight: '600' }]} numberOfLines={1}>{o.label}</Text>
                  {o.subtitle ? <Text style={s.sub} numberOfLines={1}>{o.subtitle}</Text> : null}
                </View>
                {on ? <Ionicons name="checkmark-circle" size={23} color={NAVY} /> : <View style={s.dot} />}
              </Pressable>
            </View>
          );
        })}
      </View>

      {data.multi ? (
        <Pressable onPress={confirmMulti} style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
          <GradientCTABackground radius={27} />
          <Text style={s.ctaText}>Conferma</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },

  list: {},
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEDF0' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, minHeight: 58 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 13, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '600', color: NAVY },
  body: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 16, fontWeight: '500', color: INK },
  sub: { fontSize: 13, color: MUTED },
  dot: { width: 23, height: 23 },

  cta: {
    marginTop: 12, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: NAVY, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
