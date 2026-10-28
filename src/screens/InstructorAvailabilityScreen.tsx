import React, { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { VITA_ART } from '../theme/vitaArt';
import { softEnter } from '../utils/motion';
import { useSession } from '../context/SessionContext';

const H_PAD = 20;

/**
 * Disponibilità dell'istruttore — REG-639 clay, direzione «D · Mix». Si apre
 * dall'orologio nella testata dell'Agenda: copertina della sede in alto (oggi
 * sempre il segnaposto `sedeCartina`, finché il titolare non carica la foto
 * dalla web app), indietro clay sopra la copertina, poi una card in rilievo
 * che sale sulla copertina con titolo, riga e la settimana a colpo d'occhio;
 * sotto le righe dei giorni e le eccezioni (ClaySection/ClayList).
 */
export const InstructorAvailabilityScreen = () => {
  const { instructorId } = useSession();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
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
  const intro = (
    <>
      <Text style={styles.title} accessibilityRole="header">Disponibilità</Text>
      <Text style={styles.subtitle}>
        {isPublication ? 'Modalità pubblicazione: scegli le settimane da aprire' : 'Quando gli allievi possono prenotarti'}
      </Text>
    </>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={CLAY.ink} colors={[CLAY.ink]} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <Image source={VITA_ART.sedeCartina} style={[styles.cover, { width: winW, height: insets.top + 150 }]} resizeMode="cover" />

        {!instructorId ? (
          <ClayEmpty
            title="Profilo istruttore mancante"
            text="Il tuo account non è ancora collegato a un profilo istruttore."
          />
        ) : modeLoading ? (
          <ClaySurface style={[styles.skeleton, styles.lift]}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={styles.skRow}>
                <SkeletonBlock width={110} height={15} radius={7} />
                <SkeletonBlock width={150} height={12} radius={6} style={styles.skSub} />
              </View>
            ))}
          </ClaySurface>
        ) : (
          <Animated.View entering={softEnter()} key={editorKey} style={styles.lift}>
            {isPublication ? (
              <>
                <ClaySurface style={styles.introCard} radius={26}>{intro}</ClaySurface>
                <PublicationModeEditor instructorId={instructorId} onToast={onToast} />
              </>
            ) : (
              <DefaultAvailabilityEditor instructorId={instructorId} weeks={weeks} onToast={onToast} intro={intro} />
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Indietro clay sopra la copertina (resta fermo mentre si scorre). */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <ClayIconButton icon="back" onPress={goBack} accessibilityLabel="Indietro" testID="availability-back" />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: H_PAD, flexDirection: 'row' },
  content: { paddingHorizontal: H_PAD },
  cover: { marginHorizontal: -H_PAD },
  /** La card sale sulla copertina. */
  lift: { marginTop: -34 },
  introCard: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 18 },
  title: { fontSize: 28, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 14.5, color: CLAY.ink3, marginTop: 3 },
  skeleton: { paddingVertical: 4, paddingHorizontal: 0 },
  skRow: { paddingVertical: 14, paddingHorizontal: 18 },
  skSub: { marginTop: 7 },
});
