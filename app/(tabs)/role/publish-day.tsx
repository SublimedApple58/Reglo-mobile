import React, { useState, useSyncExternalStore } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import RangesEditor from '../../../src/components/RangesEditor';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { publishDayStore } from '../../../src/stores/publishDayStore';
import { TimeRange } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const FLUENT_CLOCK = require('../../../assets/icons/fluent-clock.png');

const DEFAULT_RANGES: TimeRange[] = [{ startMinutes: 540, endMinutes: 1080 }];

const minutesToDate = (m: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

export default function PublishDayScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(publishDayStore.subscribe, publishDayStore.get);

  const [available, setAvailable] = useState<boolean>(data?.available ?? false);
  const [ranges, setRanges] = useState<TimeRange[]>(
    data?.ranges && data.ranges.length ? data.ranges : [...DEFAULT_RANGES],
  );

  if (!data) return <View style={s.root} />;

  const handlePickTime = (index: number, field: 'start' | 'end') => {
    const range = ranges[index];
    if (!range) return;
    const mins = field === 'start' ? range.startMinutes : range.endMinutes;
    const key = field === 'start' ? 'startMinutes' : 'endMinutes';
    data.openTimePicker(minutesToDate(mins), (d) => {
      const m = d.getHours() * 60 + d.getMinutes();
      setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: m } : r)));
    });
  };

  const handleSave = () => {
    data.onSave(available, available ? ranges : []);
    router.back();
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <SheetScaffold
        contentContainerStyle={{ gap: 18, paddingBottom: 18 }}
        footer={
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
          >
            <GradientCTABackground radius={27} />
            <Text style={s.ctaText}>Salva</Text>
          </Pressable>
        }
      >
        <View style={s.headerBlock}>
          <Image source={FLUENT_CLOCK} style={s.headerIcon} />
          <Text style={s.title}>{data.dayLabel}</Text>
          <Text style={s.subtitle}>Scegli i tuoi orari per questo giorno.</Text>
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Disponibile</Text>
            <Text style={s.toggleDesc}>{available ? 'Gli allievi possono prenotare' : 'Giorno di riposo'}</Text>
          </View>
          <ToggleSwitch value={available} onValueChange={setAvailable} />
        </View>

        {available && (
          <View>
            <Text style={s.label}>FASCE ORARIE</Text>
            <RangesEditor
              ranges={ranges}
              onChange={setRanges}
              onPickTime={handlePickTime}
              onAddRange={() => setRanges((prev) => [...prev, { startMinutes: 540, endMinutes: 1080 }])}
            />
          </View>
        )}
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 18 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  headerIcon: { width: 46, height: 46, resizeMode: 'contain', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4, textTransform: 'capitalize' },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECECEC',
  },
  toggleLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  toggleDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  label: { fontSize: 11.5, fontWeight: '700', color: '#9AA1AC', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 },

  cta: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
