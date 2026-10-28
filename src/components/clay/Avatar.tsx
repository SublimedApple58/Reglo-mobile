import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { avatarColors } from '../../utils/avatarColors';
import { SOFT_SPRING } from '../../utils/motion';
import { initialsOf } from '../../road/format';
import { UserPhotoCircle } from '../UserPhotoCircle';

/**
 * Volto clay (§0) — lo stesso in tutta l'app: foto profilo (`UserPhotoCircle`,
 * come la tab Allievi), altrimenti iniziali sul colore ricavato dall'id.
 * Volume: ombra esterna sul cerchio + luce/ombra interna in un velo SOPRA la
 * foto (l'ombra interna di un nodo sta sotto i figli e la foto la coprirebbe).
 * `selected` = anello nero che compare morbido, il volto si stringe dentro.
 */
export function Avatar({
  userId,
  name,
  size = 64,
  selected,
}: {
  userId: string | null | undefined;
  name: string;
  size?: number;
  selected?: boolean;
}) {
  const ring = useAnimatedStyle(() => ({
    opacity: withTiming(selected ? 1 : 0, { duration: 180 }),
    transform: [{ scale: withSpring(selected ? 1 : 0.9, SOFT_SPRING) }],
  }));
  const face = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(selected ? (size - 8) / size : 1, SOFT_SPRING) }],
  }));
  const { bg, fg } = avatarColors(userId ?? name);
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[s.wrap, { width: size, height: size }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.ring, { borderRadius: size / 2 }, ring]} />
      <Animated.View style={[round, s.face, CLAY_SHADOW.avatar, face]}>
        <View style={[round, s.clip]}>
          <UserPhotoCircle userId={userId} size={size}>
            <View style={[round, s.initials, { backgroundColor: bg }]}>
              <Text style={[s.initialsTx, { fontSize: Math.round(size * 0.3), color: fg }]}>{initialsOf(name)}</Text>
            </View>
          </UserPhotoCircle>
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }, s.gloss]} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2.5, borderColor: CLAY.ink },
  face: { backgroundColor: CLAY.surface },
  clip: { overflow: 'hidden' },
  gloss: {
    boxShadow: [
      { offsetX: 0, offsetY: 1.5, blurRadius: 0, spreadDistance: 0, color: 'rgba(255,255,255,0.55)', inset: true },
      { offsetX: 0, offsetY: -2, blurRadius: 4, spreadDistance: 0, color: 'rgba(17,17,17,0.08)', inset: true },
    ],
  },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsTx: { fontWeight: '600', letterSpacing: -0.3 },
});
