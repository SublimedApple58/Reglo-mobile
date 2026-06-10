import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';

/**
 * Native iOS page-sheet modal (slides up as a card, swipe-down to dismiss).
 * Drop-in replacement for the custom `BottomSheet` on screens that want the
 * native presentation. Always shows a grabber handle (never an X close button).
 *
 * Note: native page sheets cannot block swipe-to-dismiss declaratively, so
 * `closeDisabled` is accepted for API compatibility but only guards the
 * `onRequestClose` callback — a hard swipe can still dismiss. Callers should
 * make in-flight actions safe to interrupt.
 */
type Props = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  title?: string;
  titleRight?: React.ReactNode;
  footer?: React.ReactNode;
  closeDisabled?: boolean;
  children: React.ReactNode;
};

export const NativePageSheet = ({
  visible,
  onClose,
  onClosed,
  title,
  titleRight,
  footer,
  closeDisabled = false,
  children,
}: Props) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => { if (!closeDisabled) onClose(); }}
      onDismiss={onClosed}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : <View style={styles.flex} />}
          {titleRight ?? null}
          <Pressable onPress={onClose} hitSlop={10} disabled={closeDisabled} style={({ pressed }) => [styles.close, pressed && { opacity: 0.5 }]}>
            <Ionicons name="close" size={22} color="#1A1A2E" />
          </Pressable>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.content}>{children}</View>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 12,
  },
  title: { ...typography.subtitle, color: colors.textPrimary, flex: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
});
