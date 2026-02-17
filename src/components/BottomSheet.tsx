import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
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
}: BottomSheetProps) => {
  const insets = useSafeAreaInsets();
  const hasFooter = Boolean(footer);
  const [mounted, setMounted] = useState(visible);
  const [dismissEnabled, setDismissEnabled] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const lastDrag = useRef(0);
  const screenHeight = Dimensions.get('window').height;

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
      onClosed?.();
    });
  }, [visible, mounted, screenHeight, backdropOpacity, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => dragEnabled && !closeDisabled,
        onMoveShouldSetPanResponder: (_, gesture) =>
          dragEnabled && !closeDisabled && Math.abs(gesture.dy) > 4,
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
    [dragEnabled, closeDisabled, dragY]
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
          style={[
            styles.sheetCard,
            hasFooter ? styles.sheetCardWithFooter : null,
            { paddingBottom: hasFooter ? 0 : spacing.lg + insets.bottom },
            hasFooter ? { minHeight: minHeight ?? 320 } : null,
            { transform: [{ translateY: Animated.add(translateY, dragY) }] },
          ]}
        >
          <View style={styles.dragZone} {...panResponder.panHandlers} />
          <View style={styles.body}>
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
            <View style={styles.content}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {children}
            </View>
          </View>
          {hasFooter ? (
            <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
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
    backgroundColor: 'rgba(250, 252, 255, 0.86)',
    width: '100%',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 0,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 6,
  },
  sheetCardWithFooter: {
    justifyContent: 'space-between',
  },
  dragZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  body: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  content: {
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
