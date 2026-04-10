import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  minHeight?: number;
  dragEnabled?: boolean;
  closeDisabled?: boolean;
  closeOnBackdrop?: boolean;
  bottomInsetMode?: 'safe' | 'none';
  showHandle?: boolean;
  titleRight?: React.ReactNode;
};

export const BottomSheet = ({
  visible,
  onClose,
  onClosed,
  title,
  children,
  footer,
  minHeight,
  dragEnabled = true,
  closeDisabled = false,
  closeOnBackdrop = true,
  bottomInsetMode = 'safe',
  showHandle = false,
  titleRight,
}: BottomSheetProps) => {
  const insets = useSafeAreaInsets();
  const bottomInset = bottomInsetMode === 'none' ? 0 : insets.bottom;
  const cardBottomPadding = bottomInsetMode === 'none' ? 0 : spacing.lg + bottomInset;
  const footerBottomPadding = bottomInsetMode === 'none' ? 0 : spacing.lg + bottomInset;
  const hasFooter = Boolean(footer);
  const windowHeight = Dimensions.get('window').height;
  const maxSheetHeight = windowHeight * 0.75;
  const [mounted, setMounted] = useState(visible);
  const [dismissEnabled, setDismissEnabled] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const lastDrag = useRef(0);
  const sheetHeight = useRef(0);
  const screenHeight = Dimensions.get('window').height;
  const topInset = insets.top || 20;

  const resetDrag = () => {
    dragY.setValue(0);
    lastDrag.current = 0;
  };

  const triggerClose = (fromDrag = false) => {
    if (closeDisabled) return;
    if (fromDrag) {
      const baseOffset = Math.max(0, lastDrag.current);
      translateY.setValue(baseOffset);
      dragY.setValue(0);
    }
    onClose();
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setDismissEnabled(false);
      resetDrag();
      translateY.setValue(screenHeight);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 240,
        }),
      ]).start(() => {
        setDismissEnabled(true);
      });
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      resetDrag();
      translateY.setValue(screenHeight);
      keyboardOffset.setValue(0);
      setKeyboardVisible(false);
      onClosed?.();
    });
  }, [visible, mounted, screenHeight, backdropOpacity, translateY, keyboardOffset]);

  useEffect(() => {
    if (!mounted) return;

    const resolveKeyboardOffset = (event: KeyboardEvent) => {
      const screenY = event.endCoordinates?.screenY;
      const byHeight = Math.max(0, (event.endCoordinates?.height ?? 0) - bottomInset);
      let raw: number;
      if (typeof screenY === 'number') {
        const overlap = Math.max(0, screenHeight - screenY);
        const byScreen = Math.max(0, overlap - bottomInset);
        raw = Math.max(byScreen, byHeight);
      } else {
        raw = byHeight;
      }
      // Cap so the sheet top never goes above the top safe area
      if (sheetHeight.current > 0) {
        const maxOffset = Math.max(0, screenHeight - sheetHeight.current - topInset);
        return Math.min(raw, maxOffset);
      }
      return raw;
    };

    const animateKeyboard = (toValue: number, event?: KeyboardEvent) => {
      const duration = Platform.OS === 'ios' ? (event?.duration ?? 220) : (event?.duration ?? 180);
      Animated.timing(keyboardOffset, {
        toValue,
        duration,
        useNativeDriver: true,
      }).start();
    };

    const onShowOrChange = (event: KeyboardEvent) => {
      const nextOffset = resolveKeyboardOffset(event);
      setKeyboardVisible(nextOffset > 0);
      animateKeyboard(nextOffset, event);
    };

    const onHide = (event: KeyboardEvent) => {
      setKeyboardVisible(false);
      animateKeyboard(0, event);
    };

    const subs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', onShowOrChange),
            Keyboard.addListener('keyboardWillChangeFrame', onShowOrChange),
            Keyboard.addListener('keyboardDidShow', onShowOrChange),
            Keyboard.addListener('keyboardWillHide', onHide),
            Keyboard.addListener('keyboardDidHide', onHide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', onShowOrChange),
            Keyboard.addListener('keyboardDidHide', onHide),
          ];

    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, [mounted, bottomInset, keyboardOffset]);

  const animatedSheetTranslate = useMemo(
    () =>
      Animated.add(
        Animated.add(translateY, dragY),
        Animated.multiply(keyboardOffset, -1),
      ),
    [translateY, dragY, keyboardOffset],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          dragEnabled && !closeDisabled && !keyboardVisible,
        onMoveShouldSetPanResponder: (_, gesture) =>
          dragEnabled && !closeDisabled && !keyboardVisible && Math.abs(gesture.dy) > 4,
        onPanResponderMove: (_, gesture) => {
          if (!dragEnabled || closeDisabled) return;
          const drag = gesture.dy < 0 ? gesture.dy * 0.2 : gesture.dy;
          const clamped = Math.max(-8, drag);
          lastDrag.current = clamped;
          dragY.setValue(clamped);
        },
        onPanResponderRelease: (_, gesture) => {
          if (!dragEnabled || closeDisabled) return;
          const shouldClose = gesture.dy > 120 || gesture.vy > 0.9;
          if (shouldClose) {
            triggerClose(true);
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
              stiffness: 220,
              damping: 18,
            }).start();
          }
        },
      }),
    [dragEnabled, closeDisabled, dragY, keyboardVisible]
  );

  if (!mounted) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={mounted}
      onRequestClose={() => triggerClose(false)}
    >
      <View style={styles.backdrop}>
        <Animated.View style={[styles.backdropOverlay, { opacity: backdropOpacity }]} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => triggerClose(false)}
          disabled={!dismissEnabled || closeDisabled || !closeOnBackdrop}
        />
        <Animated.View
          {...panResponder.panHandlers}
          onLayout={(e) => { sheetHeight.current = e.nativeEvent.layout.height; }}
          style={[
            styles.sheetCard,
            hasFooter ? styles.sheetCardWithFooter : null,
            { paddingBottom: hasFooter ? 0 : cardBottomPadding },
            hasFooter ? { minHeight: minHeight ?? 320, maxHeight: maxSheetHeight } : { maxHeight: maxSheetHeight },
            { transform: [{ translateY: animatedSheetTranslate }] },
          ]}
        >
          <View style={styles.dragZone} {...panResponder.panHandlers} />
          {showHandle ? (
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>
          ) : null}
          <View style={styles.body}>
            {!showHandle ? (
              <View style={styles.header}>
                <Pressable
                  onPress={() => triggerClose(false)}
                  hitSlop={8}
                  style={styles.close}
                  disabled={closeDisabled}
                >
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.content}>
              {title ? (
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{title}</Text>
                  {titleRight ?? null}
                </View>
              ) : null}
              {children}
            </View>
          </View>
          {hasFooter ? (
            <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 30, 0.45)',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 6,
  },
  sheetCardWithFooter: {},
  dragZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  body: {
    flex: 1,
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    gap: spacing.sm,
  },
  footer: {
    width: '100%',
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 22,
    lineHeight: 22,
    color: colors.textPrimary,
  },
});
