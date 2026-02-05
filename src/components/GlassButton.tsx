import React from 'react';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

type GlassButtonProps = {
  label: string;
  onPress?: () => void;
};

export const GlassButton = ({ label, onPress }: GlassButtonProps) => {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
      <BlurView intensity={28} tint="light" style={styles.blur}>
        <View style={styles.content}>
          <Text style={styles.label}>{label}</Text>
        </View>
      </BlurView>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  blur: {
    borderRadius: 16,
  },
  content: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.glass,
    alignItems: 'center',
  },
  label: {
    ...typography.body,
    color: colors.navy,
  },
});
