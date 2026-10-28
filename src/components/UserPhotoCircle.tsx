import React, { useState } from 'react';
import { ImageStyle, StyleProp, View } from 'react-native';
import { useInstructorPhotoUrl, useUserPhotoUrl } from '../services/userPhotos';
import { FadeImage, SkeletonFill } from './FadeImage';

/**
 * Avatar con foto profilo se disponibile, altrimenti il fallback esistente
 * (children, tipicamente il cerchio a iniziali). Wrappa il markup attuale
 * senza cambiarlo: la foto ne prende il posto con la stessa taglia.
 *
 * Giro Road (Tiziano 28/10): mai a scatto. Finché non si sa se c'è una foto
 * → skeleton; la foto entra in dissolvenza sopra lo skeleton; senza foto (o
 * se non si carica) → le iniziali.
 */
export function UserPhotoCircle({
  userId,
  instructorId,
  size,
  style,
  children,
}: {
  userId?: string | null;
  instructorId?: string | null;
  size: number;
  style?: StyleProp<ImageStyle>;
  children: React.ReactNode;
}) {
  const userUrl = useUserPhotoUrl(userId);
  const instructorUrl = useInstructorPhotoUrl(userId ? null : instructorId);
  const url = userId ? userUrl : instructorId ? instructorUrl : null;
  const [failed, setFailed] = useState<string | null>(null);
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (url === undefined) {
    return (
      <View style={[round, style as object]}>
        <SkeletonFill radius={size / 2} />
      </View>
    );
  }
  if (!url || failed === url) return <>{children}</>;

  return <FadeImage source={{ uri: url }} style={[round, style]} onError={() => setFailed(url)} />;
}
