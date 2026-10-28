import React, { useEffect, useRef, useState } from 'react';
import { useCachedPhotoUri } from '../services/photoDiskCache';
import { ImageProps, ImageSourcePropType, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const FADE_MS = 200;
// Ease morbida e simmetrica: con un out-cubic l'80% arrivava nei primi 60 ms
// e la foto sembrava comparire di botto (Tiziano 28/10).
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * Foto che non compare mai a scatto (giro Road, Tiziano 28/10): sotto uno
 * skeleton clay sobrio, la foto entra in dissolvenza (~200 ms) appena è
 * decodificata. Gli URL remoti chiedono la cache del sistema (`force-cache`
 * su iOS) e passano dalla cache su disco di `photoDiskCache`: alla seconda
 * apertura arrivano dal file). Niente expo-image: è un
 * modulo nativo che il binario 2.4.0 non ha (un OTA lo farebbe crashare).
 * «Riduci movimento» non spegne la dissolvenza (regola fissa).
 */
export function FadeImage({
  source,
  style,
  resizeMode = 'cover',
  skeleton = true,
  onError,
  testID,
}: {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageProps['resizeMode'];
  skeleton?: boolean;
  onError?: () => void;
  testID?: string;
}) {
  const remote = typeof source === 'object' && source && 'uri' in source ? source.uri : undefined;
  // Foto remota → file locale se già salvato (cache su disco, `photoDiskCache`).
  const uri = useCachedPhotoUri(remote);
  const opacity = useSharedValue(0);
  const [shown, setShown] = useState(false);

  // Nuova foto nello stesso posto: si riparte dallo skeleton. Solo a un cambio
  // vero (non al mount): se la foto è già in memoria `onLoad` può arrivare
  // prima dell'effetto e l'azzeramento la lascerebbe invisibile.
  const prevUri = useRef(uri);
  useEffect(() => {
    if (prevUri.current === uri) return;
    prevUri.current = uri;
    opacity.value = 0;
    setShown(false);
  }, [uri, opacity]);

  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const flat = StyleSheet.flatten(style) ?? {};
  const radius = typeof flat.borderRadius === 'number' ? flat.borderRadius : 0;

  return (
    <View style={[style as object, s.wrap]} testID={testID}>
      {skeleton && !shown ? <SkeletonFill radius={radius} /> : null}
      {remote && !uri ? null : (
        <Animated.Image
          source={uri ? { uri, cache: 'force-cache' } : source}
          resizeMode={resizeMode}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }, anim]}
          onLoad={() => {
            opacity.value = withTiming(
              1,
              {
                duration: FADE_MS,
                easing: EASE,
                reduceMotion: ReduceMotion.Never,
              },
              (done) => {
                if (done) runOnJS(setShown)(true);
              },
            );
          }}
          onError={onError}
        />
      )}
    </View>
  );
}

/**
 * Skeleton clay bianco: grigio appena percettibile che respira piano (lo
 * stesso ritmo di `SkeletonBlock`), riempie il posto della foto.
 */
export function SkeletonFill({ radius = 0 }: { radius?: number }) {
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 760,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [pulse]);
  const anim = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.skeleton, { borderRadius: radius }, anim]} />;
}

const s = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  // Grigio clay percettibile anche dentro il volto bianco con l'ombra (prima,
  // al 3–7%, sul telefono non si vedeva: Tiziano 28/10).
  skeleton: { backgroundColor: 'rgba(17,17,17,0.10)' },
});
