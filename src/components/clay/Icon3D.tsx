import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';

/**
 * Icona 3D colorata (design-system §0.4): solo le icone generate con l'AI in
 * stile unico — segnalazioni Road (`markerArt`), auto (`car34Art`), emblema
 * Road. Sempre su bianco, mai dentro un riquadro colorato, mai `tintColor`.
 */
export function Icon3D({
  source,
  size = 28,
  width,
  style,
  onLoad,
}: {
  source: ImageSourcePropType;
  size?: number;
  /** Per le immagini non quadrate (auto di 3/4). */
  width?: number;
  style?: StyleProp<ImageStyle>;
  /** Es. marker di mappa: fotografare la vista solo a immagine caricata. */
  onLoad?: () => void;
}) {
  return (
    <Image
      source={source}
      style={[{ width: width ?? size, height: size }, style]}
      resizeMode="contain"
      onLoad={onLoad}
      accessibilityIgnoresInvertColors
    />
  );
}
