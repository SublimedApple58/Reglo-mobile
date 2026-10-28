import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { ClayEmpty, ClayIconButton, ClaySurface } from '../components/clay';
import { DefaultAvailabilityEditor } from './DefaultAvailabilityEditor';
import { PublicationModeEditor } from './PublicationModeEditor';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { useInstructorSettings } from '../hooks/queries/useInstructorSettings';
import { CLAY } from '../theme/clay';
import { softEnter } from '../utils/motion';
import { useSession } from '../context/SessionContext';

const H_PAD = 20;

/**
 * Disponibilità dell'istruttore — REG-639 clay. Si apre dall'orologio nella
 * testata dell'Agenda: indietro clay in alto, titolo grande, la modalità in
 * una riga grigia sotto; il contenuto (settimana tipo + eccezioni, oppure
 * settimane da pubblicare) è fatto di ClaySection/ClayList su bianco puro.
 */
export const InstructorAvailabilityScreen = () => {
  const { instructorId } = useSession();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  const isPublication = availabilityMode === 'publication';
  const modeLabel = isPublication ? 'Modalità pubblicazione' : 'Modalità predefinita';

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <ClayIconButton icon="back" onPress={goBack} accessibilityLabel="Indietro" testID="availability-back" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={CLAY.ink} colors={[CLAY.ink]} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <Text style={styles.title} accessibilityRole="header">Disponibilità</Text>
        {instructorId && !modeLoading ? <Text style={styles.subtitle}>{modeLabel}</Text> : null}

        {!instructorId ? (
          <ClayEmpty
            title="Profilo istruttore mancante"
            text="Il tuo account non è ancora collegato a un profilo istruttore."
          />
        ) : modeLoading ? (
          <ClaySurface style={styles.skeleton}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={styles.skRow}>
                <SkeletonBlock width={110} height={15} radius={7} />
                <SkeletonBlock width={150} height={12} radius={6} style={styles.skSub} />
              </View>
            ))}
          </ClaySurface>
        ) : (
          <Animated.View entering={softEnter()} key={editorKey}>
            {isPublication ? (
              <PublicationModeEditor instructorId={instructorId} onToast={onToast} />
            ) : (
              <DefaultAvailabilityEditor instructorId={instructorId} weeks={weeks} onToast={onToast} />
            )}
          </Animated.View>
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  top: { paddingHorizontal: H_PAD, paddingBottom: 8, flexDirection: 'row' },
  content: { paddingHorizontal: H_PAD, paddingTop: 6 },
  title: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  subtitle: { fontSize: 15, color: CLAY.ink3, marginTop: 1 },
  skeleton: { marginTop: 26, paddingVertical: 4, paddingHorizontal: 0 },
  skRow: { paddingVertical: 14, paddingHorizontal: 18 },
  skSub: { marginTop: 7 },
});
