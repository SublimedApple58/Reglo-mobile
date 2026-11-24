import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { CLAY } from '../../theme/clay';
import { VITA_ART } from '../../theme/vitaArt';

/**
 * REG-784 — l'allievo senza crediti (o a cui mancano minuti) con «Servono
 * crediti per prenotare» acceso. Variante «Moneta» approvata da Tiziano:
 * salvadanaio ambra su un bagliore caldo; all'ingresso il salvadanaio compare
 * (260 ms) e una moneta cade nella fessura e sparisce (380 ms, una volta, senza
 * rimbalzo). Testi cortissimi: titolo di 2-4 parole + una riga.
 * L'animazione gira sempre, anche con «Riduci movimento» (design-system §0.8).
 */

const EASE = Easing.bezier(0.32, 0.72, 0, 1);

export const PiggyHero = memo(function PiggyHero({ size = 132 }: { size?: number }) {
  const pig = useSharedValue(0);
  const coin = useSharedValue(0);
  const coinSize = Math.round(size * 0.27);
  const top = Math.round(size * 0.5); // spazio sopra il salvadanaio per la caduta
  const slotY = top + size * 0.2; // la fessura, dal disegno
  useEffect(() => {
    pig.value = withTiming(1, { duration: 260, easing: EASE });
    // Parte a schermata ferma, così si vede.
    coin.value = withDelay(650, withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) }));
  }, [pig, coin]);
  const pigStyle = useAnimatedStyle(() => ({
    opacity: pig.value,
    transform: [{ scale: 0.94 + 0.06 * pig.value }],
  }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: coin.value === 0 ? 0 : coin.value < 0.8 ? 1 : 1 - (coin.value - 0.8) * 5,
    transform: [
      { translateY: (slotY - coinSize / 2) * coin.value },
      { scaleY: 1 - 0.35 * Math.max(0, coin.value - 0.8) * 5 },
    ],
  }));
  return (
    <View style={{ width: size + 40, height: size + top, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={[s.halo, { width: size * 0.62, height: size * 0.22, bottom: size * 0.16 }]} />
      <Animated.Image
        source={VITA_ART.salvadanaioAmbra}
        style={[{ width: size, height: size }, pigStyle]}
        accessibilityIgnoresInvertColors
      />
      <Animated.Image
        source={VITA_ART.moneta}
        style={[
          { position: 'absolute', top: 0, left: (size + 40) / 2 - coinSize / 2, width: coinSize, height: coinSize },
          coinStyle,
        ]}
      />
    </View>
  );
});

/** Testo centrato sotto il salvadanaio: titolo forte + una riga. */
export function CreditsText({ title, line }: { title: string; line: string }) {
  return (
    <>
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={s.line}>{line}</Text>
    </>
  );
}

/**
 * Salvadanaio con la moneta in piccolo, per la home a tre livelli (v6,
 * approvata da Tiziano il 24/11): nella card grande «Crediti finiti» (86) e
 * nella card piccola sotto la prossima guida (46). Stessa animazione di
 * `PiggyHero`, un filo più svelta; `top` = spazio sopra per la caduta.
 */
export const PiggyCoin = memo(function PiggyCoin({ size, top }: { size: number; top: number }) {
  const pig = useSharedValue(0);
  const coin = useSharedValue(0);
  const coinSize = Math.round(size * 0.28);
  const slotY = top + size * 0.2;
  useEffect(() => {
    pig.value = withTiming(1, { duration: 260, easing: EASE });
    coin.value = withDelay(550, withTiming(1, { duration: 320, easing: Easing.in(Easing.cubic) }));
  }, [pig, coin]);
  const pigStyle = useAnimatedStyle(() => ({
    opacity: pig.value,
    transform: [{ scale: 0.94 + 0.06 * pig.value }],
  }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: coin.value === 0 ? 0 : coin.value < 0.8 ? 1 : 1 - (coin.value - 0.8) * 5,
    transform: [
      { translateY: (slotY - coinSize / 2) * coin.value },
      { scaleY: 1 - 0.35 * Math.max(0, coin.value - 0.8) * 5 },
    ],
  }));
  return (
    <View style={{ width: size, height: size + top, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View
        style={[
          s.haloSmall,
          {
            width: size * 0.6,
            height: size * 0.2,
            bottom: size * 0.16,
            boxShadow: `0 0 ${Math.round(size * 0.34)}px ${Math.round(size * 0.18)}px rgba(245,165,36,0.20)`,
          },
        ]}
      />
      <Animated.Image
        source={VITA_ART.salvadanaioAmbra}
        style={[{ width: size, height: size }, pigStyle]}
        accessibilityIgnoresInvertColors
      />
      <Animated.Image
        source={VITA_ART.moneta}
        style={[
          { position: 'absolute', top: 0, left: size / 2 - coinSize / 2, width: coinSize, height: coinSize },
          coinStyle,
        ]}
      />
    </View>
  );
});

const s = StyleSheet.create({
  // Bagliore caldo sfumato (niente radial-gradient su iOS: velo + boxShadow sfocato).
  halo: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(245,165,36,0.20)',
    boxShadow: '0 0 44px 30px rgba(245,165,36,0.20)',
  },
  haloSmall: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(245,165,36,0.20)' },
  title: {
    marginTop: 10,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '600',
    color: CLAY.ink,
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  line: { marginTop: 6, fontSize: 16, lineHeight: 21, color: CLAY.ink2, textAlign: 'center' },
});
