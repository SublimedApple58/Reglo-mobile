import React, { useEffect, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LessonsOverview } from '../../../src/components/LessonsOverview';
import { allLessonsStore } from '../../../src/stores/allLessonsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function AllLessonsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(allLessonsStore.subscribe, allLessonsStore.get);

  useEffect(() => {
    return () => { allLessonsStore.clear(); };
  }, []);

  if (!data) return <View style={s.root} />;

  const { lessons, studentId, onOpenDetail } = data;

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <LessonsOverview
        studentId={studentId}
        seededUpcoming={lessons}
        onOpenDetail={(lesson) => {
          router.back();
          setTimeout(() => onOpenDetail(lesson), 350);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
});
