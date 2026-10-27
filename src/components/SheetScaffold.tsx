import React from 'react';
import { Platform, Pressable, ScrollView, ScrollViewProps, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SHEET_BOTTOM } from '../utils/sheetPresentation';
import { SOFT_LAYOUT, SOFT_TEXT_IN, SOFT_TEXT_OUT, softEnter } from '../utils/motion';

/**
 * ─── FormSheet: IL form sheet di Reglo (design-system §13.2) ────────────────
 *
 * Struttura fissa, uguale per ogni foglio:
 *   radice = scroll del foglio stesso (contentInsetAdjustmentBehavior never)
 *   └ intestazione: [leading] titolo + sottotitolo · X in alto a destra
 *   └ contenuto (entra/esce con dissolvenza morbida, l'altezza scivola)
 *   └ CTA: l'ULTIMA cosa, poi solo SHEET_BOTTOM (mai insets.bottom)
 * Presentazione della route: `FORM_SHEET` (utils/sheetPresentation): formSheet,
 * fitToContents, niente grabber, niente swipe, fondo bianco.
 *
 * `contentKey`: quando cambia (es. passo di un foglio a più passi) il contenuto
 * fa una dissolvenza incrociata invece di cambiare di botto.
 */
export function FormSheet({
  title,
  subtitle,
  leading,
  onClose,
  cta,
  children,
  contentKey,
  testID,
  scrollProps,
  headerStyle,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A sinistra del titolo: avatar, chevron «indietro». */
  leading?: React.ReactNode;
  /** Default: `router.back()`. La X è l'unico modo di chiudere il foglio. */
  onClose?: () => void;
  /** CTA (una o una colonna di bottoni): ultima cosa del foglio. */
  cta?: React.ReactNode;
  children?: React.ReactNode;
  contentKey?: string;
  testID?: string;
  scrollProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle' | 'contentInsetAdjustmentBehavior'>;
  headerStyle?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const close = onClose ?? (() => router.back());
  return (
    <ScrollView
      style={fs.scroll}
      contentContainerStyle={fs.root}
      // La safe area la gestisce il foglio: iOS non deve aggiungerla sotto la CTA.
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={false}
      testID={testID}
      {...scrollProps}
    >
      <View style={[fs.head, headerStyle]}>
        {leading}
        <View style={fs.titles}>
          {typeof title === 'string' ? (
            <Text style={fs.title} numberOfLines={2}>{title}</Text>
          ) : (
            title
          )}
          {typeof subtitle === 'string' ? (
            <Text style={fs.subtitle} numberOfLines={2}>{subtitle}</Text>
          ) : (
            subtitle
          )}
        </View>
        <SheetCloseButton onPress={close} />
      </View>

      <Animated.View
        key={contentKey ?? 'content'}
        entering={contentKey ? SOFT_TEXT_IN : softEnter()}
        exiting={SOFT_TEXT_OUT}
        layout={SOFT_LAYOUT}
      >
        {children}
      </Animated.View>

      {cta ? (
        <Animated.View layout={SOFT_LAYOUT} style={fs.cta}>
          {cta}
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

/**
 * La X dei form sheet: SEMPRE cerchio grigio pieno, identica in ogni foglio.
 * Niente X «glass» di iOS 26 (GlassCloseButton): sopra fondi diversi cambiava
 * resa da un foglio all'altro (Tiziano 28/10/2026).
 */
export function SheetCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [fs.x, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
      accessibilityRole="button"
      accessibilityLabel="Chiudi"
      testID="sheet-close"
    >
      <Ionicons name="close" size={20} color="#3A3A3C" />
    </Pressable>
  );
}

const fs = StyleSheet.create({
  scroll: { backgroundColor: '#FFFFFF' },
  // Misure §13.2.1: testata 26 sopra, CTA in fondo con SHEET_BOTTOM.
  root: { backgroundColor: '#FFFFFF', paddingTop: 26, paddingHorizontal: 22, paddingBottom: SHEET_BOTTOM },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  titles: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 40 },
  title: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.5, lineHeight: 28 },
  subtitle: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 3, lineHeight: 20 },
  x: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // Grigio pieno opaco (non trasparente): uguale su qualunque fondo.
    backgroundColor: '#EEEEF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { marginTop: 22 },
});

/**
 * ─── Legacy ────────────────────────────────────────────────────────────────
 * `SheetScaffold` resta solo per i fogli non ancora migrati a `FormSheet`
 * (elenco in design-system §13.2). Non usarlo nei fogli nuovi.
 */

const isAndroid = Platform.OS === 'android';

/**
 * Body wrapper for native form sheets that use `TALL_SHEET` (see
 * `utils/sheetPresentation`).
 *
 * - iOS: renders exactly like before — an un-flexed container that the native
 *   `fitToContents` sheet hugs. Zero visual change.
 * - Android: fills the deterministic tall detent (`flex: 1`), scrolls the body,
 *   and pins `footer` to the bottom so the CTA is always reachable even when the
 *   content grows async (the OS never re-measures the sheet on Android).
 *
 * `keyboardAware` (Android only): lifts the whole sheet body — including the
 * pinned footer — above the on-screen keyboard via reanimated's
 * `useAnimatedKeyboard`. Enable it on sheets with a `TextInput` (the Android
 * native sheet does NOT move itself out of the keyboard's way like iOS does).
 *
 * Render any fixed header BEFORE this component; pass the scrollable content as
 * children and the sticky CTA/summary as `footer`.
 */
export function SheetScaffold({
  children,
  footer,
  style,
  contentContainerStyle,
  scrollEnabled = true,
  keyboardAware = false,
  fill = false,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  keyboardAware?: boolean;
  /**
   * Force the fill-scroll-pin layout on BOTH platforms. Use when the host is a
   * full-height PAGE_SHEET (not a content-hugging form sheet): the body must
   * scroll and the footer pin to the bottom on iOS too.
   */
  fill?: boolean;
}) {
  if (isAndroid || fill) {
    return <FillScaffold {...{ footer, style, contentContainerStyle, scrollEnabled, keyboardAware }}>{children}</FillScaffold>;
  }
  return (
    <View style={style}>
      <View style={contentContainerStyle}>{children}</View>
      {footer}
    </View>
  );
}

function FillScaffold({
  children, footer, style, contentContainerStyle, scrollEnabled, keyboardAware,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollEnabled: boolean;
  keyboardAware: boolean;
}) {
  const keyboard = useAnimatedKeyboard();
  // Push the whole sheet (scroll body + pinned footer) up by the keyboard height
  // so the focused input and the CTA stay visible. No-op when keyboardAware=false.
  const kbStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardAware ? keyboard.height.value : 0,
  }));

  return (
    <Animated.View style={[{ flex: 1 }, kbStyle, style]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        // Android: RN ScrollView defaults nestedScrollEnabled=false, so the native
        // form sheet steals the vertical pan (drags/dismisses instead of scrolling
        // the body). Enabling it hands the gesture to this scroll view. No-op iOS.
        nestedScrollEnabled
      >
        {children}
      </ScrollView>
      {footer}
    </Animated.View>
  );
}
