import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, Linking, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayNavBar, useLargeTitleScroll } from '../components/ClayLargeTitle';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { ClayEmpty, ClayIconButton, ClaySurface } from '../components/clay';
import { DefaultAvailabilityEditor } from './DefaultAvailabilityEditor';
import { PublicationModeEditor } from './PublicationModeEditor';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { useInstructorSettings } from '../hooks/queries/useInstructorSettings';
import { useInstructorAvailabilityMode } from '../hooks/queries/useInstructorAvailabilityMode';
import { queryKeys } from '../hooks/queries/queryKeys';
import { NativeSegmented } from '../components/NativeSegmented';
import { AbsencesSection } from '../components/availability/AbsencesSection';
import { regloApi } from '../services/regloApi';
import type { AvailabilityMode } from '../types/regloApi';
import { CLAY } from '../theme/clay';
import { SEDE_COVER_FALLBACK } from '../theme/vitaArt';
import { softEnter } from '../utils/motion';
import { useSession } from '../context/SessionContext';
import { FadeImage } from '../components/FadeImage';

const H_PAD = 20;

/**
 * Disponibilità dell'istruttore — REG-639 clay, direzione «D · Mix». Si apre
 * dall'orologio nella testata dell'Agenda: copertina della sede in alto (la
 * foto caricata dal titolare da web, `coverPhotoUrl` della sessione; senza foto
 * o se non si carica, il segnaposto `sedeFoto`), indietro clay sopra la copertina, poi una card in rilievo
 * che sale sulla copertina con titolo, riga e la settimana a colpo d'occhio;
 * sotto le righe dei giorni e le eccezioni (ClaySection/ClayList).
 *
 * REG-794 «per conto di»: con il parametro `instructorId` di un altro
 * istruttore la apre il titolare (foglio istruttore di Oggi, orologio della
 * settimana in Agenda). Allora: «Disponibilità di Sara», modalità di QUELL'
 * istruttore (rotta B1) con il segmentato in testa e l'avviso prima del cambio,
 * Chiama in alto a destra e in fondo le Assenze (malattia, ferie, periodi).
 */
/** Altezza della copertina sotto la safe area. */
const COVER_H = 150;

type Params = { instructorId?: string; name?: string; phone?: string; focus?: string };

const MODE_OPTIONS: Array<{ value: AvailabilityMode; label: string }> = [
  { value: 'default', label: 'Predefinita' },
  { value: 'publication', label: 'A pubblicazione' },
];

export const InstructorAvailabilityScreen = () => {
  const { instructorId: myInstructorId, companies, activeCompanyId, refreshMe } = useSession();
  const params = useLocalSearchParams<Params>();
  // Per conto di un altro istruttore (solo il titolare ci arriva con il parametro).
  const forId = params.instructorId && params.instructorId !== myInstructorId ? params.instructorId : null;
  const instructorId = forId ?? myInstructorId;
  const forFirst = forId ? (params.name ?? '').trim().split(/\s+/)[0] || 'istruttore' : null;
  const phone = forId && params.phone ? params.phone : null;

  // Copertina: foto della sede caricata dal titolare (REG-639), altrimenti il
  // segnaposto. Se l'URL non si carica si torna al segnaposto, mai vuoto.
  const coverUrl = companies.find((c) => c.id === activeCompanyId)?.coverPhotoUrl ?? null;
  const [coverFailed, setCoverFailed] = useState(false);
  const coverSource = coverUrl && !coverFailed ? { uri: coverUrl } : SEDE_COVER_FALLBACK;
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { scrollY, onScroll } = useLargeTitleScroll();
  const [editorKey, setEditorKey] = useState(0);
  const [segKey, setSegKey] = useState(0);
  const [modeSaving, setModeSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  // Prima l'animazione del push, poi le Assenze (che leggono dal backend).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setSettled(true));
    return () => task.cancel();
  }, []);

  // Mode + horizon come from the (cached, persisted) settings queries. The
  // persisted cache paints instantly; the background refetch corrects it.
  const autoSettings = useAutoscuolaSettings();
  const instrSettings = useInstructorSettings();
  const ownerMode = useInstructorAvailabilityMode(forId);
  const weeks = autoSettings.data?.availabilityWeeks ?? 4;
  const availabilityMode: AvailabilityMode = forId
    ? ownerMode.data ?? 'default'
    : instrSettings.data?.settings?.availabilityMode ?? 'default';
  const modeLoading = forId
    ? ownerMode.isLoading && !ownerMode.data
    : instrSettings.isLoading && !instrSettings.data;
  const modeError = !!forId && ownerMode.isError && !ownerMode.data;

  // Lasciando la schermata, Oggi e l'agenda rileggono la disponibilità della scuola.
  useEffect(() => {
    if (!forId) return;
    return () => {
      void queryClient.invalidateQueries({ queryKey: ['school-availability', activeCompanyId] });
      void queryClient.invalidateQueries({ queryKey: ['out-of-availability', activeCompanyId] });
    };
  }, [forId, queryClient, activeCompanyId]);

  const handleRefresh = useCallback(async () => {
    setCoverFailed(false);
    // refreshMe rilegge anche la copertina, se il titolare l'ha appena cambiata.
    await Promise.all([
      autoSettings.refetch(),
      forId ? ownerMode.refetch() : instrSettings.refetch(),
      refreshMe().catch(() => undefined),
    ]);
    setEditorKey((k) => k + 1); // force the active editor to remount + refetch
  }, [autoSettings, instrSettings, ownerMode, forId, refreshMe]);

  const onToast = useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({ text, tone });
  }, []);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  // ── Modalità (titolare): avviso, poi la rotta B1; niente scrittura ottimistica ──
  const changeMode = useCallback(async (next: AvailabilityMode) => {
    if (!forId) return;
    setModeSaving(true);
    try {
      const res = await regloApi.setInstructorAvailabilityMode(forId, next);
      queryClient.setQueryData(queryKeys.instructorAvailabilityMode(activeCompanyId, forId), res.availabilityMode);
      setEditorKey((k) => k + 1);
      onToast(next === 'publication' ? `${forFirst} ora pubblica le settimane` : `${forFirst} ora usa gli orari predefiniti`);
    } catch (err) {
      setSegKey((k) => k + 1);
      onToast(err instanceof Error ? err.message : 'Errore nel cambio di modalità', 'danger');
    } finally {
      setModeSaving(false);
    }
  }, [forId, forFirst, queryClient, activeCompanyId, onToast]);

  const askMode = useCallback((next: AvailabilityMode) => {
    if (modeSaving || next === availabilityMode) return;
    // Il segmentato nativo si è già spostato: se si annulla, torna dov'era.
    const undo = () => setSegKey((k) => k + 1);
    const toPublication = next === 'publication';
    Alert.alert(
      toPublication ? `Passare ${forFirst} alla pubblicazione?` : `Riportare ${forFirst} agli orari predefiniti?`,
      toPublication
        ? 'Gli allievi potranno prenotare solo le settimane che pubblichi. Gli orari predefiniti restano salvati.'
        : 'Gli allievi prenoteranno sugli orari di ogni settimana. Le settimane pubblicate restano salvate.',
      [
        { text: 'Annulla', style: 'cancel', onPress: undo },
        { text: 'Passa', onPress: () => { void changeMode(next); } },
      ],
      { cancelable: true, onDismiss: undo },
    );
  }, [modeSaving, availabilityMode, forFirst, changeMode]);

  // Aperta da «Assenze» (Oggi): una volta pronta, scorre alla sezione. Si tiene
  // l'ultima posizione: sopra, gli editor possono ancora crescere (skeleton → righe).
  const focusedRef = useRef(false);
  const absencesYRef = useRef(0);
  const onAbsencesY = useCallback((y: number) => {
    absencesYRef.current = y;
    if (params.focus !== 'absences' || focusedRef.current) return;
    focusedRef.current = true;
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, absencesYRef.current - 70), animated: true }), 350);
  }, [params.focus, scrollRef]);

  const isPublication = availabilityMode === 'publication';
  const title = forFirst ? `Disponibilità di ${forFirst}` : 'Disponibilità';
  const intro = (
    <>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.subtitle}>
        {forFirst
          ? isPublication ? `${forFirst} apre le settimane una alla volta` : 'Quando gli allievi possono prenotarla'
          : isPublication ? 'Modalità pubblicazione: scegli le settimane da aprire' : 'Quando gli allievi possono prenotarti'}
      </Text>
      {forId ? (
        <View style={styles.seg}>
          <NativeSegmented
            key={segKey}
            options={MODE_OPTIONS}
            value={availabilityMode}
            onChange={askMode}
            testID="availability-mode-segmented"
          />
        </View>
      ) : null}
    </>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={CLAY.ink} colors={[CLAY.ink]} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={[styles.cover, { width: winW, height: insets.top + COVER_H }]}>
          <FadeImage
            source={coverSource}
            style={StyleSheet.absoluteFill}
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
        ) : modeError ? (
          <View style={styles.lift}>
            <ClaySurface style={styles.introCard} radius={26}>{intro}</ClaySurface>
            <ClayEmpty title="Disponibilità non caricata" text="Tira giù per riprovare." />
          </View>
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
                <PublicationModeEditor instructorId={instructorId} onToast={onToast} forName={forFirst ?? undefined} />
              </>
            ) : (
              <DefaultAvailabilityEditor
                instructorId={instructorId}
                weeks={weeks}
                onToast={onToast}
                intro={intro}
                forName={forFirst ?? undefined}
              />
            )}
          </Animated.View>
        )}

        {forId && forFirst && settled && !modeLoading ? (
          <Animated.View entering={softEnter()} onLayout={(e) => onAbsencesY(e.nativeEvent.layout.y)}>
            <AbsencesSection instructorId={forId} firstName={forFirst} onToast={onToast} />
          </Animated.View>
        ) : null}
      </Animated.ScrollView>

      {/* Barra a titolo grande sopra la copertina (REG-639): trasparente sulla
          foto, bianca opaca col titolo piccolo quando il titolo della card ci
          passa sotto. L'indietro resta sempre lì. */}
      <ClayNavBar
        title={title}
        scrollY={scrollY}
        onBack={goBack}
        overlay={COVER_H - 40}
        actions={
          phone ? (
            <ClayIconButton
              icon={<Ionicons name="call-outline" size={20} color={CLAY.ink} />}
              onPress={() => { void Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`); }}
              accessibilityLabel={`Chiama ${forFirst}`}
              testID="availability-call"
            />
          ) : undefined
        }
      />
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
  seg: { marginTop: 14 },
  skeleton: { paddingVertical: 4, paddingHorizontal: 0 },
  skRow: { paddingVertical: 14, paddingHorizontal: 18 },
  skSub: { marginTop: 7 },
});
