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
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHEET_BOTTOM, SHEET_SYSTEM_BOTTOM } from '../utils/sheetPresentation';
import { ClayIconButton } from './clay/ClayIconButton';
import { SOFT_LAYOUT, SOFT_TEXT_IN, SOFT_TEXT_OUT, softEnter } from '../utils/motion';

/**
 * ─── FormSheet: IL form sheet di Reglo (design-system §13.2) ────────────────
 *
 * Struttura fissa, uguale per ogni foglio (come i fogli nativi di iOS):
 *   testata FISSA e opaca: [leading] titolo + sottotitolo · X in alto a destra
 *     (linea sottile sotto solo quando il contenuto ci scorre sotto)
 *   contenuto in uno scroll (entra/esce con dissolvenza, l'altezza scivola)
 *   footer FISSO con la CTA, poi solo SHEET_BOTTOM (mai insets.bottom)
 * Altezza adattiva: se tutto ci sta niente scroll; se sfora, scorre solo il
 * centro (REG-639 fluidità, dopo la segnalazione «il contenuto passa sopra il
 * titolo e la CTA è attaccata al bordo»).
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
  actions,
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
  /** Bottoni tondi a sinistra della X (es. filtro di Pagamenti). */
  actions?: React.ReactNode;
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

  // Altezza adattiva (§13.2): il foglio abbraccia il contenuto; se sfora lo
  // schermo, scorre SOLO la parte centrale e testata e CTA restano ferme. Il
  // tetto è l'altezza massima del form sheet nativo: oltre, il sistema la
  // taglierebbe e la CTA finirebbe fuori.
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxH = winH - insets.top - SHEET_SYSTEM_BOTTOM - SHEET_TOP_GAP;
  // Il centro ha un tetto esplicito (tetto del foglio − testata − footer
  // misurati): con `flexShrink` lo scroll dentro un form sheet fitToContents
  // collassava a pochi punti.
  const [headH, setHeadH] = useState(0);
  const [footH, setFootH] = useState(0);
  const scrollMaxH = Math.max(120, maxH - headH - (cta ? footH : 0));
  // Altezza del centro ESPLICITA = min(contenuto misurato, tetto): la misura
  // nativa dello ScrollView non si aggiornava quando il contenuto cresceva
  // dopo l'apertura (es. «Prenotazione multipla») e il contenuto finiva sotto
  // la CTA. Prima della misura: altezza naturale.
  const [innerH, setInnerH] = useState(0);
  const bodyPad = BODY_PAD_TOP + (cta ? BODY_PAD_BOTTOM : BODY_PAD_BOTTOM_LAST);
  const scrollH = innerH > 0 ? Math.min(innerH + bodyPad, scrollMaxH) : undefined;

  // Linea sotto la testata solo a contenuto scorso; linea sopra il footer solo
  // se sotto c'è ancora contenuto (come le barre native di iOS).
  const [scrolled, setScrolled] = useState(false);
  const [moreBelow, setMoreBelow] = useState(false);
  const viewH = useRef(0);
  const contentH = useRef(0);
  const offsetY = useRef(0);
  const updateEdges = () => {
    const nextScrolled = offsetY.current > 2;
    const nextBelow = contentH.current - (offsetY.current + viewH.current) > 2;
    setScrolled((v) => (v === nextScrolled ? v : nextScrolled));
    setMoreBelow((v) => (v === nextBelow ? v : nextBelow));
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    updateEdges();
    scrollProps?.onScroll?.(e);
  };
  // Fogli più alti dello schermo: il contenuto scorre e UIKit non passa il
  // trascinamento al foglio. Tirato giù oltre l'inizio e rilasciato = chiudi
  // (stesse regole del gesto nativo: `busy` no, `dirty` chiede conferma).
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollProps?.onScrollEndDrag?.(e);
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
  const headLine = useAnimatedStyle(() => ({ opacity: withTiming(scrolled ? 1 : 0, { duration: 140 }) }), [scrolled]);
  const footLine = useAnimatedStyle(() => ({ opacity: withTiming(moreBelow ? 1 : 0, { duration: 140 }) }), [moreBelow]);

  return (
    // `collapsable={false}` qui e sul guscio dello scroll, testata PRIMA vista
    // (senza zIndex): react-native-screens cerca uno ScrollView fra i figli
    // diretti del foglio o lungo la catena delle prime viste e gli forza il
    // frame nativo a tutto il foglio (lo scroll finiva sotto la CTA o alto
    // pochi punti). Così non lo trova e decide solo il layout.
    <View style={[fs.sheet, isAndroid && fs.sheetFill]} testID={testID} collapsable={false}>
      {/* Testata FISSA e opaca: titolo e X non scorrono mai. */}
      <View style={[fs.head, headerStyle]} onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}>
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
        {actions ? (
          <View style={fs.actions}>
            {actions}
            <SheetCloseButton onPress={close} />
          </View>
        ) : (
          <SheetCloseButton onPress={close} />
        )}
        <Animated.View pointerEvents="none" style={[fs.headLine, headLine]} />
      </View>

      <View collapsable={false} style={isAndroid && fs.scrollFill} testID="sheet-body">
      <ScrollView
        testID="sheet-scroll"
        style={isAndroid ? fs.scrollFill : scrollH !== undefined ? { height: scrollH } : { maxHeight: scrollMaxH }}
        contentContainerStyle={[fs.body, cta ? null : fs.bodyLast]}
        // La safe area la gestisce il foglio: iOS non deve aggiungerla sotto.
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        {...scrollProps}
        onLayout={(e) => {
          viewH.current = e.nativeEvent.layout.height;
          updateEdges();
          scrollProps?.onLayout?.(e);
        }}
        onContentSizeChange={(w, h) => {
          contentH.current = h;
          updateEdges();
          scrollProps?.onContentSizeChange?.(w, h);
        }}
        onScroll={onScroll}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={32}
      >
        <Animated.View
          key={contentKey ?? 'content'}
          entering={contentKey ? SOFT_TEXT_IN : softEnter()}
          exiting={SOFT_TEXT_OUT}
          layout={SOFT_LAYOUT}
          onLayout={(e) => {
            const h = Math.ceil(e.nativeEvent.layout.height);
            setInnerH((prev) => (prev === h ? prev : h));
          }}
        >
          {children}
        </Animated.View>
      </ScrollView>
      </View>

      {/* CTA FISSA nel footer del foglio: bianco, niente fascia grigia (§13.2.1). */}
      {cta ? (
        <View style={fs.foot} testID="sheet-foot" onLayout={(e) => setFootH(e.nativeEvent.layout.height)}>
          <Animated.View pointerEvents="none" style={[fs.footLine, footLine]} />
          {cta}
        </View>
      ) : null}
    </View>
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

// Margini interni del centro = spazio per le ombre clay (lo scroll ritaglia).
const BODY_PAD_TOP = 4;
const BODY_PAD_BOTTOM = 18;
const BODY_PAD_BOTTOM_LAST = 22 + SHEET_BOTTOM;

/** Margine di sicurezza sotto il bordo alto massimo del form sheet nativo. */
const SHEET_TOP_GAP = 0;

const fs = StyleSheet.create({
  sheet: { backgroundColor: '#FFFFFF' },
  // Android: detent fisso alto (`FORM_SHEET`), il foglio lo riempie.
  sheetFill: { flex: 1 },
  // Misure §13.2.1: testata 26 sopra, padding laterale 22.
  head: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 22, paddingTop: 26, paddingBottom: 14,
    // Niente zIndex: Fabric monta le viste in ordine di zIndex e la testata
    // finirebbe dopo lo scroll; react-native-screens, che segue la prima vista,
    // troverebbe lo ScrollView e gli forzerebbe il frame a tutto il foglio.
    backgroundColor: '#FFFFFF',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  titles: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: 40 },
  title: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.5, lineHeight: 28 },
  subtitle: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 3, lineHeight: 20 },
  // Android: il centro riempie il detent fisso fra testata e footer.
  scrollFill: { flex: 1 },
  // Margini interni = spazio per le ombre clay (lo scroll ritaglia ai bordi):
  // ~4 pt sopra, 22 di lato, ~24 sotto l'ultima card.
  body: { paddingHorizontal: 22, paddingTop: BODY_PAD_TOP, paddingBottom: BODY_PAD_BOTTOM },
  bodyLast: { paddingBottom: BODY_PAD_BOTTOM_LAST },
  foot: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: SHEET_BOTTOM, backgroundColor: '#FFFFFF' },
  footLine: { position: 'absolute', left: 0, right: 0, top: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
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
