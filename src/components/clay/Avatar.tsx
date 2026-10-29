import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { CLAY } from '../../theme/clay';
import { avatarColors } from '../../utils/avatarColors';
import { SELECT_TIMING } from '../../utils/motion';
import { initialsOf } from '../../road/format';
import { UserPhotoCircle } from '../UserPhotoCircle';

/**
 * Volto clay (§0) — lo stesso in tutta l'app: foto profilo (`UserPhotoCircle`,
 * come la tab Allievi), altrimenti iniziali sul colore ricavato dall'id.
 *
 * Leggero (fluidità 29/10, Tiziano): su iOS ogni voce di `boxShadow` è uno
 * strato d'ombra più una maschera (rendering fuori schermo), rifatti a ogni
 * cambio di dimensione. Prima il volto ne aveva 5; ora:
 * - UNA sola ombra esterna sul cerchio (`AVATAR_DROP`);
 * - bordino, luce in alto e ombra interna in basso cotti in UN'immagine fissa
 *   sopra la foto (`assets/clay/avatar-gloss-*`), stesso aspetto di prima.
 * `selected` (solo dove si sceglie, es. Road) = anello nero che compare
 * morbido e volto che si stringe, a tempo fisso (`SELECT_TIMING`, 180 ms,
 * niente molla). Senza `selected` il volto è statico: nessuna animazione.
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
  if (selected === undefined) {
    return (
      <View style={[s.wrap, { width: size, height: size }]}>
        <Face userId={userId} name={name} size={size} />
      </View>
    );
  }
  return <SelectableAvatar userId={userId} name={name} size={size} selected={selected} />;
}

function SelectableAvatar({
  userId,
  name,
  size,
  selected,
}: {
  userId: string | null | undefined;
  name: string;
  size: number;
  selected: boolean;
}) {
  const ring = useAnimatedStyle(() => ({
    opacity: withTiming(selected ? 1 : 0, SELECT_TIMING),
    transform: [{ scale: withTiming(selected ? 1 : 0.94, SELECT_TIMING) }],
  }));
  const face = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(selected ? (size - 8) / size : 1, SELECT_TIMING) }],
  }));
  return (
    <View style={[s.wrap, { width: size, height: size }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.ring, { borderRadius: size / 2 }, ring]} />
      <Animated.View style={face}>
        <Face userId={userId} name={name} size={size} />
      </Animated.View>
    </View>
  );
}

const GLOSS_64 = require('../../../assets/clay/avatar-gloss-64.png');
const GLOSS_88 = require('../../../assets/clay/avatar-gloss-88.png');

/** Il cerchio: ombra esterna, foto o iniziali, lucentezza fissa sopra. */
const Face = React.memo(function Face({ userId, name, size }: { userId: string | null | undefined; name: string; size: number }) {
  const { bg, fg } = avatarColors(userId ?? name);
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[round, s.face]}>
      <View style={[round, s.clip]}>
        <UserPhotoCircle userId={userId} size={size}>
          <View style={[round, s.initials, { backgroundColor: bg }]}>
            <Text style={[s.initialsTx, { fontSize: Math.round(size * 0.3), color: fg }]}>{initialsOf(name)}</Text>
          </View>
        </UserPhotoCircle>
      </View>
      <Image source={size > 70 ? GLOSS_88 : GLOSS_64} style={[StyleSheet.absoluteFill, round]} resizeMode="stretch" />
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2.5, borderColor: CLAY.ink },
  // L'ombra esterna di prima (`CLAY_SHADOW.avatar`, la voce principale): una sola.
  face: {
    backgroundColor: CLAY.surface,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, spreadDistance: -4, color: 'rgba(17,17,17,0.22)' }],
  },
  clip: { overflow: 'hidden' },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsTx: { fontWeight: '600', letterSpacing: -0.3 },
});
