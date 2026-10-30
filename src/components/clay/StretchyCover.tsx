import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Di quanto il foglio sale sulla copertina (angoli arrotondati sopra la mappa). */
export const COVER_OVERLAP = 28;
/** La copertina scorre a metà velocità del foglio (parallasse leggera). */
const PARALLAX = 0.5;
const COVER_TIMING = { duration: 220, easing: Easing.bezier(0.2, 0, 0, 1) };

/**
 * REG-661 / piano 005 — copertina elastica alla Airbnb (design-system §0.5).
 *
 * La copertina (mappa) sta DIETRO lo scroll, in alto; nello scroll c'è prima
 * uno spazio trasparente alto quanto la copertina, poi il foglio bianco.
 * Copertina e foglio scorrono insieme:
 * - tirando giù (scroll negativo, elastico di iOS) la copertina si allarga
 *   ancorata in alto e il foglio scende con lei: mai vuoto bianco;
 * - scorrendo su la copertina sale a metà velocità sotto il foglio.
 * Con poco contenuto la copertina prende lo spazio libero, così il foglio
 * arriva fino alla tab bar e lo scroll si ferma dove finisce il contenuto:
 * l'altezza non viene mai gonfiata per forzare lo scroll.
 *
 * Solo `transform` sul contenitore, guidati dallo scroll sul thread UI: la
 * `MapView` dentro non cambia misura fotogramma per fotogramma.
 */
export function useStretchyCover({
  base,
  viewportHeight,
  bottomInset,
  scrollY: external,
  parallax = PARALLAX,
}: {
  /** Altezza della copertina a contenuto pieno. */
  base: number;
  viewportHeight: number;
  /** Spazio coperto in fondo (tab bar a vetro). */
  bottomInset: number;
  scrollY?: SharedValue<number>;
  /**
   * Velocità della copertina scorrendo su (0,5 = metà). 1 = sale col foglio:
   * serve alle liste coi lati trasparenti (Punti critici), dove una copertina
   * più lenta spunterebbe ai lati delle righe.
   */
  parallax?: number;
}) {
  const own = useSharedValue(0);
  const scrollY = external ?? own;
  const [panelHeight, setPanelHeight] = useState(0);
  // Con poco contenuto la copertina riempie lo spazio sopra il foglio.
  const fill = panelHeight ? viewportHeight - bottomInset - panelHeight + COVER_OVERLAP : 0;
  const coverHeight = Math.max(base, Math.round(fill));
  const height = useSharedValue(coverHeight);
  const [first, setFirst] = useState(true);
  useEffect(() => {
    // La prima misura arriva senza animazione (niente scatto all'apertura),
    // i cambi dopo (dati nuovi, periodo) scivolano in 220 ms.
    height.value = first ? coverHeight : withTiming(coverHeight, COVER_TIMING);
    if (panelHeight) setFirst(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverHeight]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const coverStyle = useAnimatedStyle(() => {
    const h = height.value;
    const y = scrollY.value;
    if (y < 0) {
      // Scala dal centro e poi riporta giù il bordo alto: resta ancorata in cima.
      const k = (h - y) / h;
      return { height: h, transform: [{ translateY: ((k - 1) * h) / 2 }, { scale: k }] };
    }
    return { height: h, transform: [{ translateY: -y * parallax }, { scale: 1 }] };
  });
  const spacerStyle = useAnimatedStyle(() => ({ height: height.value - COVER_OVERLAP }));

  const onPanelLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setPanelHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
  }, []);

  /** Altezza del contenuto passata a mano (liste: intestazione + righe + piede). */
  const setPanelHeightValue = useCallback((h: number) => {
    const r = Math.round(h);
    setPanelHeight((prev) => (Math.abs(prev - r) < 1 ? prev : r));
  }, []);

  return { scrollY, onScroll, coverStyle, spacerStyle, onPanelLayout, setPanelHeight: setPanelHeightValue, coverHeight };
}

/** La copertina, dietro lo scroll. */
export function StretchyCover({
  style,
  children,
  testID,
}: {
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Animated.View pointerEvents="box-none" style={[s.cover, style]} testID={testID}>
      {children}
    </Animated.View>
  );
}

/** Lo spazio trasparente in cima allo scroll, sopra cui si vede la copertina. */
export function StretchySpacer({ style }: { style: StyleProp<ViewStyle> }) {
  return <Animated.View pointerEvents="none" style={style} />;
}

/** Il foglio bianco che sale sulla copertina. */
export const stretchyPanel: ViewStyle = {
  borderTopLeftRadius: 32,
  borderTopRightRadius: 32,
  backgroundColor: '#FFFFFF',
  boxShadow: [
    { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: 'rgba(17,17,17,0.04)' },
    { offsetX: 0, offsetY: -10, blurRadius: 28, spreadDistance: -14, color: 'rgba(17,17,17,0.22)' },
  ],
};

const s = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
