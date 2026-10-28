import React, { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayNavBar, useLargeTitleScroll } from '../components/ClayLargeTitle';
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
import { SEDE_COVER_FALLBACK } from '../theme/vitaArt';
import { softEnter } from '../utils/motion';
import { useSession } from '../context/SessionContext';

const H_PAD = 20;

/**
 * Disponibilità dell'istruttore — REG-639 clay, direzione «D · Mix». Si apre
 * dall'orologio nella testata dell'Agenda: copertina della sede in alto (la
 * foto caricata dal titolare da web, `coverPhotoUrl` della sessione; senza foto
 * o se non si carica, il segnaposto `sedeFoto`), indietro clay sopra la copertina, poi una card in rilievo
 * che sale sulla copertina con titolo, riga e la settimana a colpo d'occhio;
 * sotto le righe dei giorni e le eccezioni (ClaySection/ClayList).
 */
/** Altezza della copertina sotto la safe area. */
const COVER_H = 150;

export const InstructorAvailabilityScreen = () => {
  const { instructorId, companies, activeCompanyId, refreshMe } = useSession();
  // Copertina: foto della sede caricata dal titolare (REG-639), altrimenti il
  // segnaposto. Se l'URL non si carica si torna al segnaposto, mai vuoto.
  const coverUrl = companies.find((c) => c.id === activeCompanyId)?.coverPhotoUrl ?? null;
  const [coverFailed, setCoverFailed] = useState(false);
  const coverSource = coverUrl && !coverFailed ? { uri: coverUrl } : SEDE_COVER_FALLBACK;
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const router = useRouter();
  const { scrollY, onScroll } = useLargeTitleScroll();
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
    setCoverFailed(false);
    // refreshMe rilegge anche la copertina, se il titolare l'ha appena cambiata.
    await Promise.all([autoSettings.refetch(), instrSettings.refetch(), refreshMe().catch(() => undefined)]);
    setEditorKey((k) => k + 1); // force the active editor to remount + refetch
  }, [autoSettings, instrSettings, refreshMe]);

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

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={CLAY.ink} colors={[CLAY.ink]} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={[styles.cover, { width: winW, height: insets.top + COVER_H }]}>
          <Image
            source={coverSource}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setCoverFailed(true)}
          />
          {/* Velo per la foto: chiaro in alto (orologio e indietro leggibili), nessuno al centro. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.coverVeil]} />
        </View>

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
      </Animated.ScrollView>

      {/* Barra a titolo grande sopra la copertina (REG-639): trasparente sulla
          foto, bianca opaca col titolo piccolo quando il titolo della card ci
          passa sotto. L'indietro resta sempre lì. */}
      <ClayNavBar title="Disponibilità" scrollY={scrollY} onBack={goBack} overlay={COVER_H - 40} />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: H_PAD, flexDirection: 'row' },
  content: { paddingHorizontal: H_PAD },
  cover: { marginHorizontal: -H_PAD, overflow: 'hidden' },
  coverVeil: {
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.35) 100%)',
  },
  /** La card sale sulla copertina. */
  lift: { marginTop: -34 },
  introCard: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 18 },
  title: { fontSize: 28, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 14.5, color: CLAY.ink3, marginTop: 3 },
  skeleton: { paddingVertical: 4, paddingHorizontal: 0 },
  skRow: { paddingVertical: 14, paddingHorizontal: 18 },
  skSub: { marginTop: 7 },
});
