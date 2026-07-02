import React from 'react';
import { Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

const isAndroid = Platform.OS === 'android';

/**
 * Body wrapper for native form sheets that use `TALL_SHEET` (see
 * `utils/sheetPresentation`).
 *
 * - iOS: renders exactly like before — an un-flexed container that the native
 *   `fitToContents` sheet hugs. Zero visual change.
 * - Android: fills the deterministic tall detent (`flex: 1`), scrolls the body,
 *   and pins `footer` to the bottom so the CTA is always reachable even when the
 *   content grows async (the OS never re-measures the sheet on Android).
 *
 * `keyboardAware` (Android only): lifts the whole sheet body — including the
 * pinned footer — above the on-screen keyboard via reanimated's
 * `useAnimatedKeyboard`. Enable it on sheets with a `TextInput` (the Android
 * native sheet does NOT move itself out of the keyboard's way like iOS does).
 *
 * Render any fixed header BEFORE this component; pass the scrollable content as
 * children and the sticky CTA/summary as `footer`.
 */
export function SheetScaffold({
  children,
  footer,
  style,
  contentContainerStyle,
  scrollEnabled = true,
  keyboardAware = false,
  fill = false,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  keyboardAware?: boolean;
  /**
   * Force the fill-scroll-pin layout on BOTH platforms. Use when the host is a
   * full-height PAGE_SHEET (not a content-hugging form sheet): the body must
   * scroll and the footer pin to the bottom on iOS too.
   */
  fill?: boolean;
}) {
  if (isAndroid || fill) {
    return <FillScaffold {...{ footer, style, contentContainerStyle, scrollEnabled, keyboardAware }}>{children}</FillScaffold>;
  }
  return (
    <View style={style}>
      <View style={contentContainerStyle}>{children}</View>
      {footer}
    </View>
  );
}

function FillScaffold({
  children, footer, style, contentContainerStyle, scrollEnabled, keyboardAware,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollEnabled: boolean;
  keyboardAware: boolean;
}) {
  const keyboard = useAnimatedKeyboard();
  // Push the whole sheet (scroll body + pinned footer) up by the keyboard height
  // so the focused input and the CTA stay visible. No-op when keyboardAware=false.
  const kbStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardAware ? keyboard.height.value : 0,
  }));

  return (
    <Animated.View style={[{ flex: 1 }, kbStyle, style]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        // Android: RN ScrollView defaults nestedScrollEnabled=false, so the native
        // form sheet steals the vertical pan (drags/dismisses instead of scrolling
        // the body). Enabling it hands the gesture to this scroll view. No-op iOS.
        nestedScrollEnabled
      >
        {children}
      </ScrollView>
      {footer}
    </Animated.View>
  );
}
