import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';

export type ToastTone = 'success' | 'info' | 'danger';

type ToastNoticeProps = {
  message: string | null;
  tone?: ToastTone;
  durationMs?: number;
  onHide?: () => void;
};

type ToneConfig = { icon: keyof typeof Ionicons.glyphMap; accent: string };

// Light-theme, Airbnb-restrained, mono-navy. Soft outline glyphs (no icon chip),
// refined hues — forest green / brick red — never neon, never pink.
const toneConfig: Record<ToastTone, ToneConfig> = {
  success: { icon: 'checkmark', accent: '#157F4F' },
  info: { icon: 'information-circle-outline', accent: '#1A1A2E' },
  danger: { icon: 'alert-circle-outline', accent: '#BB3B30' },
};

const HIDDEN_Y = -160; // off-screen (upward) resting position
const DISMISS_THRESHOLD = -46; // drag up past this → dismiss

export const ToastNotice = ({
  message,
  tone = 'info',
  durationMs = 3600,
  onHide,
}: ToastNoticeProps) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(HIDDEN_Y);
  const opacity = useSharedValue(0);
  const bar = useSharedValue(1); // 1 → 0 drains the auto-dismiss bar
  const liveId = useSharedValue(0); // guards stale animation callbacks

  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const [visibleTone, setVisibleTone] = useState<ToastTone>(tone);
  const idRef = useRef(0);

  const finishRemoval = useCallback(
    (id: number) => {
      if (id !== idRef.current) return; // a newer toast took over
      setVisibleMessage(null);
      onHide?.();
    },
    [onHide],
  );

  // Exit animation (slide up + fade), then unmount.
  const playExit = useCallback(
    (id: number) => {
      if (id !== idRef.current) return;
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(
        HIDDEN_Y,
        { duration: 240, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finishRemoval)(id);
        },
      );
    },
    [finishRemoval, opacity, translateY],
  );

  useEffect(() => {
    if (!message) {
      if (visibleMessage) playExit(idRef.current);
      return;
    }

    const id = ++idRef.current;
    liveId.value = id;
    setVisibleMessage(message);
    setVisibleTone(tone);

    // Reset, then animate in.
    cancelAnimation(bar);
    translateY.value = HIDDEN_Y;
    opacity.value = 0;
    bar.value = 1;
    translateY.value = withSpring(0, { damping: 18, stiffness: 280 });
    opacity.value = withTiming(1, { duration: 220 });
    // The drain bar drives auto-dismiss: when it reaches 0, play the exit.
    bar.value = withTiming(0, { duration: durationMs }, (finished) => {
      if (finished && id === liveId.value) runOnJS(playExit)(id);
    });

    return () => {
      cancelAnimation(bar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, tone, durationMs]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(bar); // pause the countdown while dragging
    })
    .onUpdate((e) => {
      // Only follow upward drags; fade as it lifts.
      translateY.value = Math.min(0, e.translationY);
      opacity.value = Math.max(0, 1 + translateY.value / 120);
    })
    .onEnd(() => {
      const id = liveId.value;
      if (translateY.value < DISMISS_THRESHOLD) {
        opacity.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(HIDDEN_Y, { duration: 220 }, (finished) => {
          if (finished) runOnJS(finishRemoval)(id);
        });
      } else {
        // Snap back and resume the countdown over the remaining time.
        translateY.value = withSpring(0, { damping: 18, stiffness: 260 });
        opacity.value = withTiming(1, { duration: 160 });
        bar.value = withTiming(0, { duration: bar.value * durationMs }, (finished) => {
          if (finished && id === liveId.value) runOnJS(playExit)(id);
        });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: bar.value }],
  }));

  if (!visibleMessage) return null;

  const config = toneConfig[visibleTone];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { top: spacing.sm + insets.top }]}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.toast, cardStyle]}>
          <Ionicons name={config.icon} size={24} color={config.accent} />
          <Text style={styles.text} numberOfLines={2}>
            {visibleMessage}
          </Text>
          <View style={styles.barTrack}>
            <Animated.View
              style={[styles.barFill, { backgroundColor: config.accent }, barStyle]}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    maxWidth: 440,
    width: '100%',
    // Soft, diffuse Airbnb shadow.
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  barTrack: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 9,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#EFEAE0',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    width: '100%',
    borderRadius: 2,
    transformOrigin: 'left',
  },
});
