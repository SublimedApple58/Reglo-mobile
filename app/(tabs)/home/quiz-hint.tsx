import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { useRouter } from 'expo-router';
import { quizHintStore } from '../../../src/stores/quizHintStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function QuizHintScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Capture the hint once at mount so it survives any remount / store clear
  // (fast refresh, StrictMode double-invoke) that would otherwise blank the sheet.
  const [data] = useState(() => quizHintStore.get());

  useEffect(() => () => { quizHintStore.clear(); }, []);

  if (!data) return <View style={s.root} />;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>{data.title}</Text>
      </View>
      <ScrollView
        style={s.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <RenderHtml
          contentWidth={width - spacing.md * 2}
          source={{ html: data.descriptionHtml }}
          baseStyle={s.html as any}
        />
      </ScrollView>
      <Pressable onPress={() => router.back()} style={s.closeBtn}>
        <Text style={s.closeText}>Chiudi</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: 24, paddingBottom: 14 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 24 },
  html: { fontSize: 16, color: '#374151', lineHeight: 26 },
  closeBtn: { alignItems: 'center', paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  closeText: { fontSize: 16, fontWeight: '600', color: colors.primary },
});
