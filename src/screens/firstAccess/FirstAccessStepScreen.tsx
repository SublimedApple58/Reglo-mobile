import React, { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
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

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={s.bar}>
        <ClayIconButton icon="back" accessibilityLabel="Indietro" onPress={() => router.back()} testID="first-access-back" />
      </View>
      <View style={s.track}>
        <Animated.View style={[s.fill, barStyle]} />
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.content}
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

        <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          {footer}
          <ClayButton
            title={cta}
            onPress={onCta}
            loading={loading}
            disabled={ctaDisabled || loading}
            testID="first-access-cta"
          />
        </View>
      </KeyboardAvoidingView>
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
  bottom: { paddingHorizontal: 24, paddingTop: 10, gap: 14, backgroundColor: CLAY.bg },
});
