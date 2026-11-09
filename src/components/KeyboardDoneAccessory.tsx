import React, { useId } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSheetNight } from '../theme/night';
import { spacing } from '../theme/spacing';

/**
 * iOS keyboard "Fatto" toolbar (input accessory view) for inputs whose keyboard
 * offers no built-in way to dismiss itself — i.e. NUMERIC pads (phone-pad,
 * number-pad, decimal-pad) which have no return key, and MULTILINE fields where
 * the return key inserts a newline instead of closing.
 *
 * Search / single-line text fields DON'T need this: give them
 * `returnKeyType="search"` (magnifying glass) or `"done"`/`"next"` and the
 * keyboard's own return key dismisses them natively.
 *
 * Usage:
 *   const { accessoryID, accessory } = useDoneAccessory();
 *   <TextInput ... inputAccessoryViewID={accessoryID} />
 *   {accessory}   // render once anywhere in the screen tree
 *
 * `useId` gives a stable unique nativeID per component instance, so multiple
 * screens mounted together (native stack) never collide on the same id. On
 * Android both values are inert (undefined / null) — InputAccessoryView is iOS
 * only, and numeric keyboards there have the system back button to dismiss.
 */
export function useDoneAccessory(label: string = 'Fatto'): {
  accessoryID: string | undefined;
  accessory: React.ReactNode;
} {
  const rawId = useId();
  // Ricca 7: sopra i fogli di Road di notte la barra è scura come la tastiera.
  const night = useSheetNight();
  if (Platform.OS !== 'ios') {
    return { accessoryID: undefined, accessory: null };
  }
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '') || 'kbDone';
  const accessory = (
    <InputAccessoryView nativeID={id}>
      <View style={[styles.bar, night && styles.barNight]}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} style={styles.btn}>
          <Text style={[styles.text, night && styles.textNight]}>{label}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
  return { accessoryID: id, accessory };
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D8D8DE',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  btn: { paddingHorizontal: 12, paddingVertical: 6 },
  text: { fontSize: 16, fontWeight: '600', color: '#111111', letterSpacing: -0.2 },
  barNight: { backgroundColor: '#2C2C2E', borderTopColor: 'rgba(255,255,255,0.12)' },
  textNight: { color: '#F2F2F2' },
});
