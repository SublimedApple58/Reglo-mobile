import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';

import { SHEET_BOTTOM } from '../utils/sheetPresentation';
import { ClayIconButton } from './clay/ClayIconButton';
import { SOFT_LAYOUT, SOFT_TEXT_IN, SOFT_TEXT_OUT, softEnter } from '../utils/motion';

/**
 * ─── FormSheet: IL form sheet di Reglo (design-system §13.2) ────────────────
 *
 * Struttura fissa, uguale per ogni foglio:
 *   radice = scroll del foglio stesso (contentInsetAdjustmentBehavior never)
 *   └ intestazione FISSA (sticky): [leading] titolo + sottotitolo · X in alto a destra
 *   └ contenuto (entra/esce con dissolvenza morbida, l'altezza scivola)
 *   └ CTA: l'ULTIMA cosa, poi solo SHEET_BOTTOM (mai insets.bottom)
 * Presentazione della route: `FORM_SHEET` (utils/sheetPresentation): formSheet,
 * fitToContents, niente grabber, fondo bianco. Si chiude con la X, trascinando
 * in basso o toccando fuori (Tiziano 28/10/2026, REG-639 fluidità).
 *
 * Chiusura col gesto — tre casi, decisi qui e non nei singoli fogli:
 * - `busy`: salvataggio in corso → il gesto non chiude (la X la blocca il foglio).
 * - `dirty`: modifiche non salvate → trascinando o con la X compare la conferma
 *   nativa «Vuoi uscire senza salvare?». Dopo un salvataggio riuscito il foglio
 *   deve mettere `dirty` a false PRIMA di `router.back()` (o tenerlo legato a
 *   `!saving`), altrimenti la conferma comparirebbe anche lì.
 * - `onClose` con effetti (es. riepilogo Road che esce dalla modalità): con
 *   `closeOnGesture` il gesto non chiude da sé ma chiama `onClose`.
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
  busy,
  dirty,
  closeOnGesture,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A sinistra del titolo: avatar, chevron «indietro». */
  leading?: React.ReactNode;
  /** Default: `router.back()`. */
  onClose?: () => void;
  /** CTA (una o una colonna di bottoni): ultima cosa del foglio. */
  cta?: React.ReactNode;
  children?: React.ReactNode;
  contentKey?: string;
  testID?: string;
  scrollProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle' | 'contentInsetAdjustmentBehavior'>;
  headerStyle?: StyleProp<ViewStyle>;
  /** Operazione in corso: trascinare o toccare fuori non chiude. */
  busy?: boolean;
  /** Modifiche non salvate: prima di chiudere chiede conferma. */
  dirty?: boolean;
  /** Il gesto di chiusura esegue `onClose` invece di chiudere da sé. */
  closeOnGesture?: boolean;
}) {
  const router = useRouter();
  const closeFn = onClose ?? (() => router.back());
  const release = useSheetDismissGuard({ busy, dirty, onGesture: closeOnGesture ? closeFn : undefined });
  // La X di un foglio con `closeOnGesture` non deve rientrare nel gesto.
  const close = () => {
    release();
    closeFn();
  };

  // Testata fissa: il fondo bianco compare solo quando il contenuto le scorre
  // sotto. A riposo è trasparente, così non copre l'alone delle ombre clay del
  // primo blocco (prima tagliava in un rettangolo l'ombra dell'anello 13/6).
  const [scrolled, setScrolled] = useState(false);
  const userOnScroll = scrollProps?.onScroll;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > 2;
    if (next !== scrolled) setScrolled(next);
    userOnScroll?.(e);
  };
  // Fogli più alti dello schermo: il contenuto scorre e UIKit non passa il
  // trascinamento al foglio. Tirato giù oltre l'inizio e rilasciato = chiudi
  // (stesse regole del gesto nativo: `busy` no, `dirty` chiede conferma).
  const userOnScrollEndDrag = scrollProps?.onScrollEndDrag;
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    userOnScrollEndDrag?.(e);
    if (busy || e.nativeEvent.contentOffset.y > -PULL_TO_CLOSE) return;
    // A rimbalzo finito: chiudere mentre lo scroll torna su lasciava il velo
    // scuro del foglio piantato sullo schermo.
    pendingClose.current = true;
    // Rete di sicurezza se iOS non manda la fine del rimbalzo.
    setTimeout(finishPendingClose, 450);
  };
  const pendingClose = useRef(false);
  const finishPendingClose = () => {
    if (!pendingClose.current) return;
    pendingClose.current = false;
    close();
  };
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollProps?.onMomentumScrollEnd?.(e);
    finishPendingClose();
  };
  const backdrop = useAnimatedStyle(() => ({ opacity: withTiming(scrolled ? 1 : 0, { duration: 140 }) }), [scrolled]);

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
      // Testata FISSA (Tiziano 28/10 notte): titolo e X restano in alto a
      // destra, il contenuto scorre sotto. È il primo figlio dello scroll.
      stickyHeaderIndices={[0]}
      testID={testID}
      {...scrollProps}
      onScroll={onScroll}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={32}
    >
      {/* Lo sticky header di RN sposta lo stile del figlio su un suo
          contenitore: la riga titolo·X sta in una View interna. */}
      <View style={fs.headSticky}>
        <Animated.View pointerEvents="none" style={[fs.headBackdrop, backdrop]} />
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
 * La X dei form sheet: SEMPRE il cerchio bianco in rilievo del clay v2
 * (`ClayIconButton`), identica in ogni foglio (Tiziano 28/10/2026, REG-639;
 * prima era un cerchio grigio pieno). Niente X «glass» di iOS 26.
 */
export function SheetCloseButton({ onPress }: { onPress: () => void }) {
  return <ClayIconButton icon="close" onPress={onPress} accessibilityLabel="Chiudi" testID="sheet-close" />;
}

/**
 * Chiusura col gesto di un form sheet (trascinare giù, toccare fuori), usata da
 * `FormSheet` e da chi presenta un foglio senza `FormSheet`.
 * - `busy`: il gesto è spento (`gestureEnabled: false` sulla route); le chiusure
 *   via codice (`router.back()` dopo il salvataggio) passano.
 * - `dirty`: ogni chiusura (gesto, X, codice) chiede conferma nativa.
 * - `onGesture`: il gesto non chiude da sé, chiama questa funzione (una volta).
 */
export function useSheetDismissGuard({
  busy,
  dirty,
  onGesture,
}: {
  busy?: boolean;
  dirty?: boolean;
  onGesture?: () => void;
}) {
  const navigation = useNavigation();
  const [released, setReleased] = useState(false);
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;

  useEffect(() => {
    if (busy === undefined) return;
    navigation.setOptions({ gestureEnabled: !busy });
  }, [busy, navigation]);

  const intercept = !!onGesture && !released;
  usePreventRemove(!!dirty || intercept, ({ data }) => {
    if (dirty) {
      Alert.alert('Vuoi uscire senza salvare?', 'Le modifiche andranno perse.', [
        { text: 'Resta', style: 'cancel' },
        { text: 'Esci', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ]);
      return;
    }
    // Una volta sola: l'uscita vera (anche da un altro navigatore) deve passare.
    setReleased(true);
    onGestureRef.current?.();
  });

  return () => setReleased(true);
}

/** Quanto tirare giù (pt, oltre l'inizio) un foglio che scorre per chiuderlo. */
const PULL_TO_CLOSE = 64;

const fs = StyleSheet.create({
  scroll: { backgroundColor: '#FFFFFF' },
  // Misure §13.2.1: testata 26 sopra, CTA in fondo con SHEET_BOTTOM.
  root: { backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingBottom: SHEET_BOTTOM },
  // Testata fissa: fondo bianco pieno a tutta larghezza, così il contenuto
  // che scorre sotto non si vede attraverso.
  headSticky: { marginHorizontal: -22, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 18, zIndex: 2 },
  // Fondo bianco della testata, visibile solo a contenuto scorso.
  headBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titles: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 40 },
  title: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.5, lineHeight: 28 },
  subtitle: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 3, lineHeight: 20 },
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
