import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ClayButton, ClayIconButton, Icon3D } from '../../components/clay';
import { FadeImage } from '../../components/FadeImage';
import { initialsOf } from '../../road/format';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { VITA_ART } from '../../theme/vitaArt';
import { signupProgress, useSignup } from './SignupContext';

/**
 * REG-818 — «È la tua autoscuola?» / «È il tuo istruttore?».
 *
 * Fascia in alto a tutta larghezza (diorama chiaro: la Panda arriva al semaforo verde), senza bordo: il
 * perimetro del video sfuma nel bianco della pagina. Nella zona sfumata in basso, la tessera clay bianca che è la protagonista: il logo dell'autoscuola
 * oppure, con il codice di un istruttore autonomo, la sua foto con il logo
 * agganciato. Sotto nome, una riga e la CTA.
 *
 * Il video parte UNA volta all'arrivo e si ferma sull'ultimo fotogramma
 * (niente loop). Sotto c'è sempre il poster (primo fotogramma, nel bundle):
 * il video gli entra sopra in dissolvenza quando è pronto, e se non parte
 * resta il poster. `expo-av` è già nel binario (OTA); `expo-video` no.
 */
const HERO_POSTER = require('../../../assets/signup/hero-poster.jpg');
// 880×720 (ritaglio centrale del 16:9), H.264 senza audio. `null` = solo poster.
const HERO_VIDEO: number | null = require('../../../assets/signup/hero.mp4');

/** Quota dell'altezza dello schermo presa dalla fascia. */
const HERO_RATIO = 0.46;
const TILE = 124;
// Sfumatura verso il bianco a più passi (curva morbida, non una rampa lineare che lascia la riga).
const FADE = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.88)', '#FFFFFF'] as const;
// In alto più leggera: sotto la status bar il video si vede ancora.
const FADE_SOFT = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.8)'] as const;
const FADE_STOPS = [0, 0.3, 0.6, 0.85, 1] as const;
const N = ReduceMotion.Never;
const EASE = Easing.out(Easing.cubic);
const IN_MS = 260;

/** Entrata: dissolvenza (e una scala appena accennata), mai di botto, senza rimbalzo. */
function useEnter(delay: number, scaleFrom = 1) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration: IN_MS, easing: EASE, reduceMotion: N }));
  }, [delay, v]);
  return useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: scaleFrom + (1 - scaleFrom) * v.value }],
  }));
}

function Hero({ height }: { height: number }) {
  const [play, setPlay] = useState(false);
  const shown: SharedValue<number> = useSharedValue(0);
  // Il video parte a schermata arrivata, non durante il push.
  useEffect(() => {
    const t = setTimeout(() => setPlay(true), 380);
    return () => clearTimeout(t);
  }, []);
  const videoStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <View style={[s.hero, { height }]}>
      <Image source={HERO_POSTER} style={s.heroMedia} resizeMode="cover" />
      {HERO_VIDEO ? (
        <Animated.View style={[StyleSheet.absoluteFill, videoStyle]} pointerEvents="none">
          <Video
            source={HERO_VIDEO}
            style={s.heroMedia}
            resizeMode={ResizeMode.COVER}
            shouldPlay={play}
            isMuted
            isLooping={false}
            onReadyForDisplay={() => {
              shown.value = withTiming(1, { duration: 220, easing: EASE, reduceMotion: N });
            }}
          />
        </Animated.View>
      ) : null}
      {/* Nessun bordo: il perimetro del video si scioglie nel bianco della pagina (REG-818). */}
      <LinearGradient colors={FADE_SOFT} locations={FADE_STOPS} style={s.fadeTop} pointerEvents="none" start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} />
      <LinearGradient colors={FADE} locations={FADE_STOPS} style={s.fadeLeft} pointerEvents="none" start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} />
      <LinearGradient colors={FADE} locations={FADE_STOPS} style={s.fadeRight} pointerEvents="none" start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
      <LinearGradient colors={FADE} locations={FADE_STOPS} style={s.fadeBottom} pointerEvents="none" />
    </View>
  );
}

function Initials({ name, color }: { name: string; color: string | null }) {
  return (
    <View style={[s.face, { backgroundColor: color ?? CLAY.ink }]}>
      <Text style={s.initials}>{initialsOf(name)}</Text>
    </View>
  );
}

export function SignupSchoolStep() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { draft } = useSignup();
  const school = draft.school;
  const [logoFailed, setLogoFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const logoUrl = !logoFailed ? school?.company.logoUrl ?? null : null;
  // Risposta vecchia del server (senza `instructor`): resta il nome, senza foto.
  const instructor =
    school?.instructor ?? (school?.instructorName ? { name: school.instructorName, photoUrl: null, color: null } : null);
  const companyName = school?.company.name ?? 'La tua autoscuola';

  const title = instructor ? instructor.name : companyName;
  const detail = instructor
    ? `Il tuo istruttore · ${companyName}`
    : school?.locationName
      ? `Sede di ${school.locationName}`
      : 'È la tua autoscuola?';

  const position = signupProgress('school');
  const heroH = Math.round(winH * HERO_RATIO);

  const heroIn = useEnter(0);
  const tileIn = useEnter(90, 0.94);
  const titleIn = useEnter(160);
  const detailIn = useEnter(220);

  const logo = logoUrl ? (
    <FadeImage source={{ uri: logoUrl }} style={s.logo} resizeMode="contain" onError={() => setLogoFailed(true)} />
  ) : null;

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <Animated.View style={heroIn}>
        <Hero height={heroH} />
      </Animated.View>

      <View style={[s.bar, { top: insets.top }]}>
        <ClayIconButton icon="back" accessibilityLabel="Indietro" onPress={() => router.back()} testID="first-access-back" />
      </View>
      {position ? (
        <View style={[s.track, { top: insets.top + 56 }]}>
          <View style={[s.fill, { width: `${((position.index + 1) / Math.max(position.total, 1)) * 100}%` }]} />
        </View>
      ) : null}

      <Animated.View style={[s.tileWrap, tileIn]}>
        {instructor ? (
          <View style={s.person}>
            <View style={[s.faceRing, CLAY_SHADOW.raise]}>
              {instructor.photoUrl && !photoFailed ? (
                <FadeImage
                  source={{ uri: instructor.photoUrl }}
                  style={s.face}
                  resizeMode="cover"
                  onError={() => setPhotoFailed(true)}
                />
              ) : (
                <Initials name={instructor.name} color={instructor.color} />
              )}
            </View>
            {logo ? <View style={[s.logoChip, CLAY_SHADOW.raise]}>{React.cloneElement(logo, { style: s.logoSmall })}</View> : null}
          </View>
        ) : (
          <View style={[s.tile, CLAY_SHADOW.raise]}>{logo ?? <Icon3D source={VITA_ART.edificio} size={72} />}</View>
        )}
      </Animated.View>

      <View style={s.texts}>
        <Animated.Text style={[s.title, titleIn]} numberOfLines={3} testID="signup-school-name">
          {title}
        </Animated.Text>
        <Animated.Text style={[s.detail, detailIn]} numberOfLines={2}>
          {detail}
        </Animated.Text>
      </View>

      <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <ClayButton title="Sì, continua" onPress={() => router.push('/(auth)/signup/name')} testID="first-access-cta" />
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [s.below, pressed && s.pressed]}
          accessibilityRole="button"
          testID="signup-change-code"
        >
          <Text style={s.belowText}>
            {instructor ? 'Non è il tuo istruttore? ' : 'Non è lei? '}
            <Text style={s.belowAction}>Cambia codice</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  hero: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  fadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: '22%' },
  fadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%' },
  fadeLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '20%' },
  fadeRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '20%' },
  // Dimensioni esplicite: con il solo absoluteFill l'immagine del bundle restava a grandezza naturale.
  heroMedia: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  bar: { position: 'absolute', left: 0, right: 0, height: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  // Stessa linea nera degli altri passi: il diorama è chiaro.
  track: { position: 'absolute', left: 20, right: 20, height: 2, borderRadius: 1, backgroundColor: 'rgba(17,17,17,0.08)', overflow: 'hidden' },
  fill: { height: 2, backgroundColor: CLAY.ink },
  // Nella zona sfumata in fondo alla fascia: metà sopra, metà sotto.
  tileWrap: { alignItems: 'center', marginTop: -TILE / 2 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 90, height: 90, borderRadius: 18 },
  person: { width: TILE, height: TILE },
  faceRing: {
    width: TILE,
    height: TILE,
    borderRadius: TILE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: { width: TILE - 10, height: TILE - 10, borderRadius: (TILE - 10) / 2, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 40, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.5 },
  logoChip: {
    position: 'absolute',
    right: -10,
    bottom: -6,
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSmall: { width: 35, height: 35, borderRadius: 9 },
  texts: { paddingHorizontal: 28, marginTop: 26, alignItems: 'center' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8, textAlign: 'center' },
  detail: { fontSize: 16, lineHeight: 22, color: CLAY.ink3, marginTop: 8, textAlign: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 10, gap: 14, backgroundColor: CLAY.bg },
  below: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  pressed: { opacity: 0.5 },
  belowText: { fontSize: 15, lineHeight: 20, color: CLAY.ink3 },
  belowAction: { fontWeight: '600', color: CLAY.ink },
});
