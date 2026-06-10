import React, { useSyncExternalStore } from 'react';
import { Image, ImageSourcePropType, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { homeAddSheetStore } from '../../../src/stores/homeAddSheetStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

type Row = {
  key: string;
  label: string;
  img: ImageSourcePropType;
  run: () => void;
  show: boolean;
};

/**
 * Native content-hugging formSheet for the instructor "+" menu. Reads the seeded
 * handlers from `homeAddSheetStore`; on tap it dismisses, then runs the action
 * once the sheet has finished dismissing (iOS) so we never present a new
 * drawer/modal while this one is still animating away. Airbnb-style: 3D Fluent
 * icons floating bare, no chevrons, whitespace separation.
 */
export default function AddActionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(homeAddSheetStore.subscribe, homeAddSheetStore.get);

  const pick = (run: () => void) => {
    router.back();
    if (Platform.OS === 'ios') setTimeout(run, 380);
    else run();
  };

  if (!data) return <View style={s.root} />;

  const rows: Row[] = [
    { key: 'book', label: 'Prenota guida', img: require('../../../assets/icons/fluent-calendar.png'), run: data.onBook, show: data.canBook },
    { key: 'block', label: 'Blocca slot', img: require('../../../assets/icons/fluent-lock.png'), run: data.onBlock, show: true },
    { key: 'exam', label: 'Crea esame', img: require('../../../assets/icons/fluent-graduate.png'), run: data.onExam, show: true },
    { key: 'group', label: 'Guida di gruppo', img: require('../../../assets/icons/fluent-people.png'), run: data.onGroupLesson, show: data.canGroupLesson },
    { key: 'sick', label: 'Malattia', img: require('../../../assets/icons/fluent-thermometer.png'), run: data.onSick, show: true },
  ].filter((r) => r.show);

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 16 }]}>
      <View style={s.header}>
        <Text style={s.title}>Aggiungi</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.close, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={22} color="#64748B" />
        </Pressable>
      </View>
      {rows.map((r) => (
        <Pressable
          key={r.key}
          onPress={() => pick(r.run)}
          style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        >
          <Image source={r.img} style={s.img} resizeMode="contain" />
          <Text style={s.label}>{r.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A2E',
    letterSpacing: -0.4,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 19,
    paddingHorizontal: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  rowPressed: {
    backgroundColor: '#F4F5F9',
  },
  img: {
    width: 42,
    height: 42,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A2E',
  },
});
