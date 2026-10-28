import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { ICONS_3D, type Icon3DName } from '../../theme/icons3d';

/**
 * Icona 3D colorata del clay v2. `name` dal registro `ICONS_3D`, oppure
 * `source` per le immagini Road (segnalazioni, auto). Sempre su bianco,
 * mai dentro un riquadro colorato, mai `tintColor`.
 */
export function Icon3D({
  name,
  source,
  size = 28,
  width,
  style,
  onLoad,
}: {
  name?: Icon3DName;
  source?: ImageSourcePropType;
  size?: number;
  /** Per le immagini non quadrate (auto di 3/4). */
  width?: number;
  style?: StyleProp<ImageStyle>;
  /** Es. marker di mappa: fotografare la vista solo a immagine caricata. */
  onLoad?: () => void;
}) {
  const src = source ?? (name ? ICONS_3D[name] : undefined);
  if (!src) return null;
  return (
    <Image
      source={src}
      style={[{ width: width ?? size, height: size }, style]}
      resizeMode="contain"
      onLoad={onLoad}
      accessibilityIgnoresInvertColors
    />
  );
}
