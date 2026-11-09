import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ClayButton, ClayIconButton } from '../../components/clay';
import { CLAY } from '../../theme/clay';
import { FIRST_ACCESS_STEPS, type FirstAccessStep } from './FirstAccessContext';

const BAR_TIMING = {
  duration: 260,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.Never,
} as const;

/** Dissolvenza degli errori e dei testi che cambiano (§15: 150–200 ms, niente entrate dal basso). */
export const fadeIn = FadeIn.duration(180).reduceMotion(ReduceMotion.Never);
export const fadeOut = FadeOut.duration(150).reduceMotion(ReduceMotion.Never);

/** Respiro fra la CTA e la tastiera aperta. */
const KEYBOARD_GAP = 12;
/** Curva vicina a quella della tastiera di iOS: parte svelta, si posa senza rimbalzo. */
const KEYBOARD_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

/**
 * La tastiera si apre a schermata arrivata, non durante il push: con
 * `autoFocus` saliva a metà della transizione e il layout saltava (lo
 * «sfarfallio» segnalato da Tiziano il 09/11). Il primo passo è la radice
 * dello stack annidato, quindi la fine del push la riceve il genitore.
 */
export function useFocusAfterPush(ref: RefObject<TextInput | null>) {
  const navigation = useNavigation();
  useEffect(() => {
    let done = false;
    const focus = () => {
      if (done) return;
      done = true;
      ref.current?.focus();
    };
    // Primo passo = radice dello stack annidato: il suo «transitionEnd» arriva
    // subito al montaggio, quello vero è del genitore che fa il push.
    const isRoot = navigation.getState()?.index === 0;
    const target = isRoot ? navigation.getParent() ?? navigation : navigation;
    const unsubs = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target.addListener('transitionEnd' as any, (e: any) => {
        if (!e?.data?.closing) focus();
      }),
    ];
    // Rete di sicurezza se l'evento non arriva (es. schermata già in cima).
    const t = setTimeout(focus, 900);
    return () => {
      done = true;
      unsubs.forEach((u) => u());
      clearTimeout(t);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Un passo del «Primo accesso»: barra in alto con «indietro» (testata clay,
 * §0.5) e una linea sottile di avanzamento, titolo grande, contenuto, CTA nera
 * fissa in fondo sopra la tastiera. Ogni passo è una schermata dello stack
 * nativo: il push e lo swipe indietro sono quelli di iOS.
 */
export function FirstAccessStepScreen({
  step,
  title,
  subtitle,
  hero,
  children,
  cta,
  ctaDisabled,
  loading,
  onCta,
  error,
  footer,
  revealKey,
}: {
  step: FirstAccessStep;
  title: string;
  subtitle?: string;
  /** Elemento caldo sopra il titolo (icona 3D), solo dove serve. */
  hero?: React.ReactNode;
  children?: React.ReactNode;
  cta: string;
  ctaDisabled?: boolean;
  loading?: boolean;
  onCta: () => void;
  error?: string | null;
  footer?: React.ReactNode;
  /** Quando diventa vero (es. errore sul campo) lo scroll porta il fondo del contenuto in vista. */
  revealKey?: unknown;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const index = FIRST_ACCESS_STEPS.indexOf(step);
  const target = (index + 1) / FIRST_ACCESS_STEPS.length;
  // Parte dal passo prima e arriva al suo: la linea «cresce» a ogni avanti.
  const progress = useSharedValue(index / FIRST_ACCESS_STEPS.length);

  useEffect(() => {
    progress.value = withTiming(target, BAR_TIMING);
  }, [progress, target]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  // La CTA sale CON la tastiera: parte all'annuncio di iOS (`keyboardWillShow`)
  // con la stessa durata e una curva vicina a quella della tastiera, su una
  // traslazione (niente KeyboardAvoidingView, che spostava tutto di colpo; su
  // iOS 26 `useAnimatedKeyboard` dà l'altezza solo a tastiera arrivata). Lo
  // spazio sotto lo scroll segue lo stesso valore solo per accorciare l'area
  // che scorre.
  const restBottom = Math.max(insets.bottom, 16) + 8;
  const lift = useSharedValue(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const move = (to: number, duration?: number) => {
      lift.value = withTiming(to, { duration: duration || 250, easing: KEYBOARD_EASING, reduceMotion: ReduceMotion.Never });
    };
    const show = Keyboard.addListener('keyboardWillShow', (e) =>
      move(Math.max(0, e.endCoordinates.height - restBottom + KEYBOARD_GAP), e.duration),
    );
    const hide = Keyboard.addListener('keyboardWillHide', (e) => move(0, e.duration));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [lift, restBottom]);
  const ctaLift = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }));
  const keyboardSpace = useAnimatedStyle(() => ({ height: lift.value }));
  const [ctaH, setCtaH] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!revealKey && !error) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [revealKey, error]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={s.bar}>
        <ClayIconButton icon="back" accessibilityLabel="Indietro" onPress={() => router.back()} testID="first-access-back" />
      </View>
      <View style={s.track}>
        <Animated.View style={[s.fill, barStyle]} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.flex}
        contentContainerStyle={[s.content, { paddingBottom: ctaH + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hero ? <View style={s.hero}>{hero}</View> : null}
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        <View style={s.body}>{children}</View>
        {error ? (
          <Animated.Text entering={fadeIn} exiting={fadeOut} style={s.error} testID="first-access-error">
            {error}
          </Animated.Text>
        ) : null}
      </ScrollView>

      {Platform.OS === 'ios' ? <Animated.View style={keyboardSpace} /> : null}

      <Animated.View
        style={[s.bottom, { paddingBottom: restBottom }, Platform.OS === 'ios' && ctaLift]}
        onLayout={(e) => setCtaH(e.nativeEvent.layout.height)}
      >
        {footer}
        <ClayButton
          title={cta}
          onPress={onCta}
          loading={loading}
          disabled={ctaDisabled || loading}
          testID="first-access-cta"
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  flex: { flex: 1 },
  bar: { height: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  track: { height: 2, marginHorizontal: 20, borderRadius: 1, backgroundColor: 'rgba(17,17,17,0.08)', overflow: 'hidden' },
  fill: { height: 2, width: '100%', backgroundColor: CLAY.ink, transformOrigin: 'left' },
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },
  hero: { marginBottom: 18 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 16, lineHeight: 22, color: CLAY.ink3, marginTop: 8 },
  body: { marginTop: 28, gap: 18 },
  error: { fontSize: 14.5, lineHeight: 20, fontWeight: '500', color: '#C13515', marginTop: 16 },
  // Fissa in fondo (iOS: la finestra non si ridimensiona con la tastiera, Android sì).
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 10, gap: 14, backgroundColor: CLAY.bg },
});
