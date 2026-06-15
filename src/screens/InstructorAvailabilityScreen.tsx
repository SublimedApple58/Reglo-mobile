import React, { useCallback, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { DefaultAvailabilityEditor } from './DefaultAvailabilityEditor';
import { PublicationModeEditor } from './PublicationModeEditor';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { useInstructorSettings } from '../hooks/queries/useInstructorSettings';
import { colors } from '../theme';
import { useSession } from '../context/SessionContext';

const H_PAD = 22;
const COMPACT_H = 54;
const LARGE_TITLE_H = 56;

const FLUENT_CALENDAR = require('../../assets/icons/fluent-calendar.png');

export const InstructorAvailabilityScreen = () => {
  const { instructorId } = useSession();
  const insets = useSafeAreaInsets();
  const [editorKey, setEditorKey] = useState(0);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  // Mode + horizon come from the (cached, persisted) settings queries. The
  // persisted cache paints instantly; the background refetch corrects it.
  const autoSettings = useAutoscuolaSettings();
  const instrSettings = useInstructorSettings();
  const weeks = autoSettings.data?.availabilityWeeks ?? 4;
  const availabilityMode = instrSettings.data?.settings?.availabilityMode ?? 'default';
  const modeLoading = instrSettings.isLoading && !instrSettings.data;

  const handleRefresh = useCallback(async () => {
    await Promise.all([autoSettings.refetch(), instrSettings.refetch()]);
    setEditorKey((k) => k + 1); // force the active editor to remount + refetch
  }, [autoSettings, instrSettings]);

  const onToast = useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({ text, tone });
  }, []);

  /* ── Collapsible header ── */
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const largeTitleStyle = useAnimatedStyle(() => {
    const ty = scrollY.value < 0
      ? scrollY.value
      : interpolate(scrollY.value, [0, LARGE_TITLE_H], [0, -12], Extrapolation.CLAMP);
    return {
      opacity: interpolate(scrollY.value, [0, LARGE_TITLE_H * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: ty }],
    };
  });
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [LARGE_TITLE_H * 0.5, LARGE_TITLE_H * 0.95], [0, 1], Extrapolation.CLAMP),
  }));
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));

  const isPublication = availabilityMode === 'publication';
  const modeLabel = isPublication ? 'Modalità pubblicazione' : 'Modalità predefinita';

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {/* Sticky collapsible header */}
      <View style={[styles.headerWrap, { height: insets.top + COMPACT_H, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, headerBgStyle]} pointerEvents="none">
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,253,253,0.96)' }]} />
          )}
          <View style={styles.headerBorder} />
        </Animated.View>
        <View style={styles.compactRow}>
          <Animated.Text style={[styles.compactTitle, compactStyle]} numberOfLines={1}>Disponibilità</Animated.Text>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={insets.top + COMPACT_H}
          />
        }
        contentContainerStyle={[styles.content, { paddingTop: insets.top + COMPACT_H }]}
      >
        <View style={{ height: LARGE_TITLE_H, justifyContent: 'flex-end' }}>
          <Animated.Text style={[styles.largeTitle, largeTitleStyle]}>Disponibilità</Animated.Text>
        </View>

        {/* Mode badge — only in publication mode (default mode reads as the plain screen) */}
        {isPublication ? (
          <View style={styles.modeRow}>
            <View style={styles.modeBadge}>
              <Image source={FLUENT_CALENDAR} style={styles.modeIcon} />
              <Text style={styles.modeBadgeText}>{modeLabel}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.modeSpacer} />
        )}

        {!instructorId ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Profilo istruttore mancante</Text>
            <Text style={styles.emptyText}>Il tuo account non è ancora collegato a un profilo istruttore.</Text>
          </View>
        ) : modeLoading ? (
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonDaysRow}>
              {Array.from({ length: 7 }).map((_, i) => (
                <SkeletonBlock key={i} width={36} height={44} radius={12} />
              ))}
            </View>
            <SkeletonBlock width="100%" height={56} radius={999} style={{ marginTop: 16 }} />
            <SkeletonBlock width="100%" height={50} radius={25} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)} key={editorKey}>
            {isPublication ? (
              <PublicationModeEditor instructorId={instructorId} onToast={onToast} />
            ) : (
              <DefaultAvailabilityEditor instructorId={instructorId} weeks={weeks} onToast={onToast} />
            )}
          </Animated.View>
        )}
      </Animated.ScrollView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: H_PAD, paddingBottom: 28 },

  /* Header */
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerBorder: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: colors.border,
  },
  compactRow: { height: COMPACT_H, justifyContent: 'center', alignItems: 'center' },
  compactTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  largeTitle: { fontSize: 32, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.5 },

  /* Mode badge */
  modeRow: { flexDirection: 'row', marginTop: 8, marginBottom: 22 },
  modeSpacer: { height: 18 },
  modeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0',
  },
  modeIcon: { width: 16, height: 16, resizeMode: 'contain' },
  modeBadgeText: { fontSize: 12.5, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.1 },

  /* Skeleton */
  skeletonCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0',
  },
  skeletonDaysRow: { flexDirection: 'row', gap: 6 },

  /* Empty */
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  emptyText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
});
