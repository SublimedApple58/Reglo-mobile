import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';

/**
 * Content-hugging native sheet: a transparent Modal whose card is anchored to the
 * bottom and sized to its content (adapts to content height, like a formSheet
 * detent). X close top-right (never a handle), navy palette. Use for SHORT,
 * fixed-height sheets. For tall/scrollable content use `NativePageSheet`.
 */
type Props = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  title?: string;
  footer?: React.ReactNode;
  closeDisabled?: boolean;
  children: React.ReactNode;
};

export const NativeFormSheet = ({ visible, onClose, onClosed, title, footer, closeDisabled = false, children }: Props) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => { if (!closeDisabled) onClose(); }}
      onDismiss={onClosed}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!closeDisabled) onClose(); }} />
        <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : <View style={styles.flex} />}
            <Pressable onPress={onClose} hitSlop={10} disabled={closeDisabled} style={({ pressed }) => [styles.close, pressed && { opacity: 0.5 }]}>
              <Ionicons name="close" size={22} color="#1A1A2E" />
            </Pressable>
          </View>
          <View>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,18,30,0.35)' },
  card: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
  },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, gap: 12 },
  title: { ...typography.subtitle, color: colors.textPrimary, flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: spacing.md, gap: spacing.sm },
});
