import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  SharedValue,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayIconButton, ClaySearchField } from './clay';
import { CLAY } from '../theme/clay';

/** Altezza della barra sotto la safe area: ci stanno i bottoni clay da 40 e la ricerca. */
export const NAV_BAR_H = 56;
/** Dopo quanto scorrere il titolo grande è sparito sotto la barra. */
const LARGE_TITLE_H = 40;

/** Scroll condiviso fra barra e titolo grande: va su un `Animated.ScrollView`. */
export function useLargeTitleScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  return { scrollY, onScroll };
}

type Search = {
  active: boolean;
  onActiveChange: (active: boolean) => void;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  testID?: string;
};

/**
 * Barra di navigazione clay a titolo grande (REG-639, giro dopo la prova
 * sull'iPhone di Tiziano): come la large title di iOS. Fissa e opaca sotto la
 * safe area, il titolo grande sta nel contenuto (`ClayLargeTitle`) e scorrendo
 * lascia il posto al titolo piccolo nella barra; la linea sottile compare solo
 * quando il contenuto passa sotto. Indietro a sinistra, azioni a destra (bottoni
 * tondi clay). Con `search` la ricerca si apre nella barra stessa, con
 * «Annulla», come la search bar nativa. Lo scroll va SOTTO la barra (non
 * dietro): così il pull-to-refresh resta visibile.
 */
export function ClayNavBar({
  title,
  scrollY,
  onBack,
  actions,
  search,
  overlay,
}: {
  title: string;
  scrollY: SharedValue<number>;
  onBack?: () => void;
  actions?: React.ReactNode;
  search?: Search;
  /**
   * Barra SOPRA una copertina (es. la foto della sede in Disponibilità):
   * trasparente in cima, diventa bianca opaca col titolo piccolo quando lo
   * scroll arriva a questo punto (dove il titolo grande passa sotto la barra).
   */
  overlay?: number;
}) {
  const insets = useSafeAreaInsets();
  const searching = !!search?.active;

  const titleAt = overlay ?? LARGE_TITLE_H;
  const inlineTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [titleAt * 0.6, titleAt], [0, 1], Extrapolation.CLAMP),
  }));
  const lineFrom = overlay ? overlay - 8 : 0;
  const hairline = useAnimatedStyle(() => ({
    opacity: searching ? 1 : interpolate(scrollY.value, [lineFrom, lineFrom + 8], [0, 1], Extrapolation.CLAMP),
  }));
  const overlayBg = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [titleAt * 0.55, titleAt * 0.9], [0, 1], Extrapolation.CLAMP),
  }));

  const closeSearch = () => {
    Keyboard.dismiss();
    search?.onChangeText('');
    search?.onActiveChange(false);
  };

  return (
    <View
      style={[s.bar, overlay !== undefined && s.overlayBar, { paddingTop: insets.top, height: insets.top + NAV_BAR_H }]}
      pointerEvents="box-none"
    >
      {overlay !== undefined ? <Animated.View style={[StyleSheet.absoluteFill, s.overlayFill, overlayBg]} pointerEvents="none" /> : null}
      {searching && search ? (
        <Animated.View key="search" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={s.row}>
          <ClaySearchField
            autoFocus
            value={search.value}
            onChangeText={search.onChangeText}
            placeholder={search.placeholder}
            style={s.field}
            testID={search.testID}
          />
          <Pressable onPress={closeSearch} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.5 }} testID="nav-search-cancel">
            <Text style={s.cancel}>Annulla</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View key="nav" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={s.row}>
          <View style={s.side}>
            {onBack ? <ClayIconButton icon="back" onPress={onBack} accessibilityLabel="Indietro" testID="page-back" /> : null}
          </View>
          <Animated.Text style={[s.inlineTitle, inlineTitle]} numberOfLines={1} pointerEvents="none">
            {title}
          </Animated.Text>
          <View style={[s.side, s.sideRight]}>{actions}</View>
        </Animated.View>
      )}
      <Animated.View style={[s.hairline, hairline]} pointerEvents="none" />
    </View>
  );
}

/** Titolo grande + riga grigia di contesto: primo elemento dello scroll. */
export function ClayLargeTitle({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <View style={s.large}>
      <Text style={s.largeTitle} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: CLAY.bg, zIndex: 10 },
  overlayBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'transparent' },
  overlayFill: { backgroundColor: CLAY.bg },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 },
  side: { minWidth: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sideRight: { flex: 1, justifyContent: 'flex-end' },
  // Centrato su tutta la barra (non fra i lati, che possono avere 0 o 2 bottoni).
  inlineTitle: { position: 'absolute', left: 116, right: 116, textAlign: 'center', fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  field: { flex: 1 },
  cancel: { fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.14)' },
  large: { paddingTop: 2 },
  scrollPad: { paddingTop: 4 },
  largeTitle: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  subtitle: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, marginTop: 2 },
});

/**
 * Schermata intera con la barra a titolo grande (il componente unico da usare
 * nelle pagine dell'app istruttore): barra fissa sopra, poi lo scroll col
 * titolo grande come primo elemento. `contentContainerStyle` NON deve
 * aggiungere la safe area in alto: ci pensa la barra.
 */
export const ClayLargeTitleScroll = React.forwardRef<
  Animated.ScrollView,
  Omit<React.ComponentProps<typeof Animated.ScrollView>, 'onScroll' | 'children'> & {
    title: string;
    subtitle?: string | null;
    onBack?: () => void;
    actions?: React.ReactNode;
    search?: Search;
    /** Nasconde il titolo grande (es. mentre si cerca). */
    hideLargeTitle?: boolean;
    children?: React.ReactNode;
  }
>(function ClayLargeTitleScroll(
  { title, subtitle, onBack, actions, search, hideLargeTitle, children, contentContainerStyle, ...scroll },
  ref,
) {
  const { scrollY, onScroll } = useLargeTitleScroll();
  return (
    <>
      <ClayNavBar title={title} scrollY={scrollY} onBack={onBack} actions={actions} search={search} />
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        {...scroll}
        contentContainerStyle={[s.scrollPad, contentContainerStyle]}
      >
        {hideLargeTitle ? null : <ClayLargeTitle title={title} subtitle={subtitle} />}
        {children}
      </Animated.ScrollView>
    </>
  );
});
