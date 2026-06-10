import React, { useMemo } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Stable identifiers for the new student-phase ducks. The path mapping below
 * is static (RN bundler requires literal require() calls). Drop the assets
 * under `assets/ducks/` with these exact filenames and uncomment the
 * matching require() line — the placeholder will be replaced automatically.
 */
export type DuckKind =
  | 'step-awaiting'
  | 'step-theory'
  | 'step-pratica'
  | 'step-patentato'
  | 'hero-awaiting'
  | 'hero-patentato';

// Each entry is `() => require(...) | null`. Wrapped in a thunk so the
// bundler does not try to resolve missing files at module load.
const DUCK_SOURCES: Record<DuckKind, () => number | null> = {
  // Mini ducks for the timeline checkpoints.
  'step-awaiting': () => require('../../assets/ducks/duck-step-awaiting.png'),
  'step-theory': () => require('../../assets/ducks/duck-step-theory.png'),
  'step-pratica': () => require('../../assets/ducks/duck-step-pratica.png'),
  'step-patentato': () => require('../../assets/ducks/duck-step-patentato.png'),

  // Hero ducks.
  'hero-awaiting': () => require('../../assets/ducks/duck-hero-awaiting.png'),
  // Reusing the step-patentato artwork as the hero for now — works well
  // because the step pose already reads as a celebration at large size.
  'hero-patentato': () => require('../../assets/ducks/duck-hero-patentato.png'),
};

type Props = {
  kind: DuckKind;
  /** Logical size of the slot in dp (square). Default 48. */
  size?: number;
  /** Active variant gets a soft navy halo to draw the eye. */
  active?: boolean;
  /** When the placeholder is rendered, this is the accent of the empty disc. */
  placeholderTone?: 'muted' | 'active' | 'success';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

/**
 * Renders the duck for a given slot, or a clean placeholder disc while the
 * asset is being produced. Keeps the layout stable so the screens look
 * right today and "wake up" the moment the designer drops the PNGs.
 */
export const DuckSlot: React.FC<Props> = ({
  kind,
  size = 48,
  active = false,
  placeholderTone = 'muted',
  style,
  imageStyle,
  accessibilityLabel,
}) => {
  const source = useMemo(() => DUCK_SOURCES[kind](), [kind]);

  const containerStyle: StyleProp<ViewStyle> = [
    {
      width: size,
      height: size,
    },
    active && {
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    style,
  ];

  if (source) {
    return (
      <View style={containerStyle}>
        <Image
          source={source}
          resizeMode="contain"
          accessibilityLabel={accessibilityLabel ?? `Paperotto ${kind}`}
          style={[
            {
              width: size,
              height: size,
            },
            imageStyle,
          ]}
        />
      </View>
    );
  }

  // Placeholder: a soft duck-shaped silhouette so the slot is never empty.
  const placeholderBg =
    placeholderTone === 'active'
      ? 'rgba(26, 26, 46, 0.16)'
      : placeholderTone === 'success'
        ? 'rgba(26, 26, 46, 0.32)'
        : 'rgba(15, 23, 42, 0.06)';
  const placeholderBorder =
    placeholderTone === 'active'
      ? colors.primary
      : placeholderTone === 'success'
        ? colors.primary
        : colors.border;

  return (
    <View
      style={[
        containerStyle,
        styles.placeholderOuter,
        {
          borderRadius: size / 2,
          backgroundColor: placeholderBg,
          borderColor: placeholderBorder,
        },
      ]}
      accessibilityLabel={accessibilityLabel ?? `Paperotto ${kind} placeholder`}
    >
      {/* Tiny dot to hint a duck body until the real PNG arrives. */}
      <View
        style={{
          width: Math.max(6, size * 0.18),
          height: Math.max(6, size * 0.18),
          borderRadius: 999,
          backgroundColor: placeholderTone === 'muted' ? colors.border : colors.primary,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  placeholderOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

export default DuckSlot;
