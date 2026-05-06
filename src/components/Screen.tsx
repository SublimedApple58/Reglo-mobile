import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
  gradient?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Screen = ({ children, gradient, style }: ScreenProps) => {
  const insets = useSafeAreaInsets();
  const Container = gradient ? LinearGradient : View;
  const containerProps = gradient
    ? { colors: ['#FAE0EF', '#F8F7F4'], locations: [0, 0.5] }
    : {};

  return (
    <Container style={[styles.root, style]} {...containerProps}>
      <View style={[styles.content, { paddingTop: insets.top }]}>{children}</View>
    </Container>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
