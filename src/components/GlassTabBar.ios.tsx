import React from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host, HStack, ZStack, Button } from '@expo/ui/swift-ui';
import { type SFSymbol } from 'sf-symbols-typescript';
import {
  background,
  border,
  cornerRadius,
  glassEffect,
  padding,
  frame,
} from '@expo/ui/swift-ui/modifiers';
import { colors, spacing } from '../theme';

const BAR_RADIUS = 26;
const ITEM_SIZE = 44;
const ITEM_RADIUS = 18;

const iconMap: Record<string, SFSymbol> = {
  Home: 'house',
  Istruttore: 'speedometer',
  Gestione: 'car',
  Settings: 'gearshape',
};

export const GlassTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: spacing.sm + insets.bottom,
        },
      ]}
      pointerEvents="box-none"
    >
      <Host matchContents>
        <ZStack
          modifiers={[
            background(colors.glass),
            glassEffect({ glass: { variant: 'regular' }, shape: 'capsule' }),
            border({ color: colors.glassBorder, width: 1 }),
            cornerRadius(BAR_RADIUS),
            padding({ vertical: 8, horizontal: 10 }),
          ]}
        >
          <HStack spacing={10} alignment="center">
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const label =
                options.tabBarLabel !== undefined
                  ? String(options.tabBarLabel)
                  : options.title !== undefined
                    ? options.title
                    : route.name;

              const isFocused = state.index === index;
              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const iconName = iconMap[label] ?? 'circle';

              return (
                <Button
                  key={route.key}
                  systemImage={iconName}
                  onPress={onPress}
                  color={isFocused ? colors.navy : colors.textMuted}
                  variant={isFocused ? 'glassProminent' : 'glass'}
                  controlSize="large"
                  modifiers={[
                    frame({ width: ITEM_SIZE, height: ITEM_SIZE }),
                    ...(isFocused
                      ? [background(colors.glassStrong), cornerRadius(ITEM_RADIUS)]
                      : [cornerRadius(ITEM_RADIUS)]),
                  ]}
                />
              );
            })}
          </HStack>
        </ZStack>
      </Host>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
