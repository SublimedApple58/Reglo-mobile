import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

/**
 * The app-wide primary-CTA surface: navy diagonal gradient (light → navy →
 * near-black) born on the phone-gate screen and promoted to every primary CTA.
 * Wrap it in a Pressable that owns radius + colored shadow; this fills it.
 * Pass the same borderRadius via `style` (the gradient clips its own corners).
 */
export const PRIMARY_GRADIENT = ['#26263F', colors.primary, '#131322'] as const;
export const PRIMARY_GRADIENT_START = { x: 0.2, y: 0 };
export const PRIMARY_GRADIENT_END = { x: 0.8, y: 1 };

/**
 * Colored drop shadow for the Pressable that hosts a GradientCTA — navy-tinted
 * and deliberately pronounced (phone-gate reference) for the 3D lift effect.
 * The shadow-owning view must NOT have overflow: 'hidden' (iOS clips it).
 */
export const primaryCtaShadow: ViewStyle = {
  shadowColor: colors.primary,
  shadowOpacity: 0.4,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
};

export const GradientCTA = ({
  style,
  children,
}: {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}) => (
  <LinearGradient
    colors={[...PRIMARY_GRADIENT]}
    start={PRIMARY_GRADIENT_START}
    end={PRIMARY_GRADIENT_END}
    style={[styles.fill, style]}
  >
    {children}
  </LinearGradient>
);

/**
 * Drop-in gradient background for an EXISTING navy Pressable: render as its
 * FIRST child (siblings paint above it) and remove the `backgroundColor` from
 * the button style — layout, padding, radius and shadows stay untouched.
 * `radius` must match the button style's borderRadius.
 */
export const GradientCTABackground = ({ radius }: { radius: number }) => (
  <LinearGradient
    colors={[...PRIMARY_GRADIENT]}
    start={PRIMARY_GRADIENT_START}
    end={PRIMARY_GRADIENT_END}
    pointerEvents="none"
    style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
  />
);

const styles = StyleSheet.create({
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
