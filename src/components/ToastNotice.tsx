import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '../theme';

export type ToastTone = 'success' | 'info' | 'danger';

type ToastNoticeProps = {
  message: string | null;
  tone?: ToastTone;
  durationMs?: number;
  onHide?: () => void;
};

type ToneConfig = {
  bg: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  shadow: string;
};

const toneConfig: Record<ToastTone, ToneConfig> = {
  success: {
    bg: '#22C55E',
    text: '#FFFFFF',
    icon: 'checkmark-circle',
    iconColor: '#FFFFFF',
    shadow: '#16A34A',
  },
  info: {
    bg: '#1E293B',
    text: '#FFFFFF',
    icon: 'information-circle',
    iconColor: '#94A3B8',
    shadow: '#0F172A',
  },
  danger: {
    bg: '#EF4444',
    text: '#FFFFFF',
    icon: 'alert-circle',
    iconColor: '#FFFFFF',
    shadow: '#DC2626',
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
  const translateY = useRef(new Animated.Value(-30)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const [visibleTone, setVisibleTone] = useState<ToastTone>(tone);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIdRef = useRef(0);

  useEffect(() => {
    // Clear any pending dismiss timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!message) {
      // Animate out if currently visible
      if (visibleMessage) {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.95, duration: 200, useNativeDriver: true }),
        ]).start(() => setVisibleMessage(null));
      }
      return;
    }

    // New message — capture id to avoid stale callbacks
    const id = ++messageIdRef.current;
    setVisibleMessage(message);
    setVisibleTone(tone);

    // Reset + animate in
    opacity.setValue(0);
    translateY.setValue(-30);
    scale.setValue(0.92);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 300, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 16, stiffness: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Schedule dismiss
    timerRef.current = setTimeout(() => {
      if (messageIdRef.current !== id) return; // stale
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.95, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        if (messageIdRef.current !== id) return; // stale
        setVisibleMessage(null);
        onHide?.();
      });
    }, durationMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message, tone, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visibleMessage) return null;

  const config = toneConfig[visibleTone];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { top: spacing.sm + insets.top },
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <View
        style={[
          styles.toast,
          { backgroundColor: config.bg, shadowColor: config.shadow },
        ]}
      >
        <Ionicons name={config.icon} size={22} color={config.iconColor} />
        <Text style={[styles.text, { color: config.text }]} numberOfLines={2}>
          {visibleMessage}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
    alignItems: 'center',
  },
  toast: {
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 400,
    width: '100%',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
});
