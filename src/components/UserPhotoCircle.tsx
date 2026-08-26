import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { useInstructorPhotoUrl, useUserPhotoUrl } from '../services/userPhotos';

/**
 * Avatar con foto profilo se disponibile, altrimenti il fallback esistente
 * (children, tipicamente il cerchio a iniziali). Wrappa il markup attuale
 * senza cambiarlo: la foto ne prende il posto con la stessa taglia.
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
  const url = userUrl ?? instructorUrl;

  if (!url) return <>{children}</>;

  return (
    <Image
      source={{ uri: url }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}
