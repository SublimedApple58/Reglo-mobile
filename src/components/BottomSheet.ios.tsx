import React, { useEffect, useMemo, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet as NativeBottomSheet } from '@expo/ui/swift-ui';
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  const screenHeight = Dimensions.get('window').height;
  const closeNotifiedRef = useRef(!visible);

  useEffect(() => {
    if (visible) {
      closeNotifiedRef.current = false;
      return;
    }
    if (!closeNotifiedRef.current) {
      closeNotifiedRef.current = true;
      onClosed?.();
    }
  }, [visible, onClosed]);

  const presentationDetents = useMemo<(number | 'medium' | 'large')[]>(() => {
    if (minHeight) {
      const minRatio = clamp(minHeight / screenHeight, 0.22, 0.95);
      return [minRatio, 'large'];
    }
    return ['medium', 'large'];
  }, [minHeight, screenHeight]);

  const handleOpenStateChange = (isOpened: boolean) => {
    if (isOpened) return;
    onClose();
    if (!closeNotifiedRef.current) {
      closeNotifiedRef.current = true;
      onClosed?.();
    }
  };

  return (
    <NativeBottomSheet
      isOpened={visible}
      onIsOpenedChange={handleOpenStateChange}
      interactiveDismissDisabled={closeDisabled || !dragEnabled || !closeOnBackdrop}
      presentationDetents={presentationDetents}
      presentationDragIndicator={dragEnabled ? 'visible' : 'hidden'}
    >
      <View style={styles.sheetCard}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
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

        {hasFooter ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
            {footer}
          </View>
        ) : null}
      </View>
    </NativeBottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetCard: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 0,
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
