import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';

export type ToastTone = 'success' | 'info' | 'danger';

type ToastNoticeProps = {
  message: string | null;
  tone?: ToastTone;
  durationMs?: number;
  onHide?: () => void;
};

const toneStyles: Record<ToastTone, { bg: string; border: string; text: string; accent: string }> = {
  success: {
    bg: '#FFFFFF',
    border: 'rgba(59, 190, 147, 0.55)',
    text: colors.textPrimary,
    accent: colors.success,
  },
  info: {
    bg: '#FFFFFF',
    border: 'rgba(90, 123, 198, 0.55)',
    text: colors.textPrimary,
    accent: colors.accent,
  },
  danger: {
    bg: '#FFFFFF',
    border: 'rgba(226, 109, 109, 0.55)',
    text: colors.textPrimary,
    accent: colors.danger,
  },
};

export const ToastNotice = ({
  message,
  tone = 'info',
  durationMs = 2600,
  onHide,
}: ToastNoticeProps) => {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  const stylesTone = useMemo(() => toneStyles[tone], [tone]);

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -10,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHide?.();
      });
    }, durationMs);

    return () => clearTimeout(timer);
  }, [message, durationMs, opacity, translateY, onHide]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { top: spacing.xl + spacing.sm + insets.top },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View
        style={[
          styles.toast,
          { backgroundColor: stylesTone.bg, borderColor: stylesTone.border },
        ]}
      >
        <View style={[styles.accent, { backgroundColor: stylesTone.accent }]} />
        <Text style={[styles.text, { color: stylesTone.text }]}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 20,
  },
  toast: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accent: {
    width: 6,
    height: '100%',
    borderRadius: 4,
  },
  text: {
    ...typography.body,
  },
});
