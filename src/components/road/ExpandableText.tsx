import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from '../../utils/haptics';

/**
 * Road — testo che si tronca ma si legge per intero toccandolo.
 *
 * Chiuso: `numberOfLines` righe con i puntini. Se il testo è davvero più lungo,
 * il tocco lo apre: l'altezza scorre in 240 ms (niente scatti, niente rimbalzi)
 * e il testo resta lo stesso, solo senza limite di righe; un altro tocco lo
 * richiude. Se ci sta tutto non c'è niente da toccare. Le altezze si misurano
 * con una copia invisibile del testo, quindi funziona anche dentro card a
 * larghezza variabile. «Riduci movimento» non spegne l'animazione (regola fissa).
 */
const DURATION = 240;

export function ExpandableText({
  text,
  numberOfLines,
  style,
  testID,
  onToggle,
}: {
  text: string;
  numberOfLines: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
  /** Avvisa chi contiene il testo (es. per tenere aperta una card mentre si legge). */
  onToggle?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [closedH, setClosedH] = useState(0);
  const [fullH, setFullH] = useState(0);
  const h = useSharedValue(-1);
  const truncated = fullH > closedH + 1 && closedH > 0;
  // Testo nuovo (es. la card passa da «tra 150 m» a «com'è andata»): si riparte chiusi.
  useEffect(() => {
    h.value = -1;
    setOpen(false);
  }, [text, h]);

  const onClosed = useCallback((e: LayoutChangeEvent) => {
    const v = Math.round(e.nativeEvent.layout.height);
    setClosedH((cur) => (cur === v ? cur : v));
  }, []);
  const onFull = useCallback((e: LayoutChangeEvent) => {
    const v = Math.round(e.nativeEvent.layout.height);
    setFullH((cur) => (cur === v ? cur : v));
  }, []);

  const toggle = () => {
    if (!truncated) return;
    Haptics.selectionAsync().catch(() => undefined);
    const next = !open;
    const ease = { duration: DURATION, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };
    if (h.value < 0) h.value = next ? closedH : fullH;
    h.value = withTiming(next ? fullH : closedH, ease);
    // Aprendo il testo intero va subito (il contenitore lo svela scorrendo);
    // chiudendo le righe tornano limitate a fine corsa.
    if (next) setOpen(true);
    else setTimeout(() => setOpen(false), DURATION);
    onToggle?.(next);
  };

  const box = useAnimatedStyle(() => (h.value < 0 ? {} : { height: h.value, overflow: 'hidden' }));
  // I margini del testo vanno sul contenitore: dentro il riquadro che si
  // allunga conterebbero nell'altezza e taglierebbero l'ultima riga.
  const flat = StyleSheet.flatten(style) ?? {};
  const { margin, marginTop, marginBottom, marginVertical, marginHorizontal, marginLeft, marginRight, ...textStyle } = flat;
  const outer = { margin, marginTop, marginBottom, marginVertical, marginHorizontal, marginLeft, marginRight };

  return (
    <View style={outer}>
      <Pressable
        onPress={toggle}
        disabled={!truncated}
        accessibilityRole={truncated ? 'button' : 'text'}
        accessibilityLabel={text}
        accessibilityHint={truncated ? (open ? 'Tocca per richiudere' : 'Tocca per leggere tutto') : undefined}
        hitSlop={{ top: 6, bottom: 6 }}
        style={s.fill}
        testID={testID}
      >
        <Animated.View style={[s.fill, box]}>
          {/* Chiuso: le righe limitate (misurano anche l'altezza da chiuso). */}
          <Text style={[textStyle, open && s.hidden]} numberOfLines={numberOfLines} onLayout={onClosed}>
            {text}
          </Text>
          {/* Aperto: il testo intero, ancorato ai due lati come la copia che lo misura
              (con la sola larghezza «auto» iOS lo lasciava su una riga). */}
          {open ? <Text style={[textStyle, s.full]}>{text}</Text> : null}
        </Animated.View>
      </Pressable>
      {/* Copia invisibile per misurare il testo intero alla stessa larghezza. */}
      <View style={s.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={textStyle} onLayout={onFull}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  // Larghezza del contenitore: senza, il testo aperto restava su una riga sola più larga della card.
  fill: { width: '100%' },
  full: { position: 'absolute', left: 0, right: 0, top: 0 },
  hidden: { opacity: 0 },
});
