import React, { useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { locationPickerStore } from '../../../src/stores/locationPickerStore';
import { InlineLocationPicker } from '../../../src/components/InlineLocationPicker';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function ManageLessonLocationScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(locationPickerStore.subscribe, locationPickerStore.get);

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title}>Cambia luogo</Text>
        <Text style={s.subtitle}>Dove inizia questa guida.</Text>
      </View>

      <SheetScaffold>
        {data ? (
          <InlineLocationPicker
            showSearch={false}
            selectedLocationId={data.selectedLocationId}
            onSelect={(loc) => { data.onSelect(loc); router.back(); }}
            onRequestCreate={data.onRequestCreate}
          />
        ) : null}
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
});
