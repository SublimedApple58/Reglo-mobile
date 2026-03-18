import React, { useEffect } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';

const TAB_ITEM_HEIGHT = 52;
const HIGHLIGHT_HEIGHT = TAB_ITEM_HEIGHT - 2;
const HIGHLIGHT_INSET = 8;
const TABBAR_SIDE_INSET = 50;
const HIGHLIGHT_OFFSET = 1;
const CONTENT_OFFSET = 0;
const CONTAINER_RADIUS = 28;

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Istruttore: 'speedometer-outline',
  Gestione: 'car-outline',
  Settings: 'settings-outline',
};

type TabItemProps = {
  label: string;
  isFocused: boolean;
  onPress: () => void;
};

const TabItem = ({ label, isFocused, onPress }: TabItemProps) => {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, { damping: 18, stiffness: 260 });
  }, [isFocused, progress]);

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + 0.15 * progress.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + 0.4 * progress.value,
  }));

  const iconName = iconMap[label] ?? 'ellipse-outline';

  return (
    <Pressable onPress={onPress} style={styles.item}>
      <Animated.View style={[styles.highlight, highlightStyle]} />
      <View style={styles.itemContent}>
        <Ionicons
          name={iconName}
          size={20}
          color={isFocused ? colors.primary : colors.textMuted}
        />
        <Animated.Text style={styles.label} accessibilityElementsHidden>
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
};

export const GlassTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: spacing.sm + insets.bottom,
          left: TABBAR_SIDE_INSET,
          right: TABBAR_SIDE_INSET,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.container}>
        <View style={styles.row}>
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

            return (
              <TabItem
                key={route.key}
                label={label}
                isFocused={isFocused}
                onPress={onPress}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.sm,
  },
  container: {
    borderRadius: CONTAINER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  item: {
    flex: 1,
    height: TAB_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    alignItems: 'center',
    gap: 2,
    transform: [{ translateY: CONTENT_OFFSET }],
  },
  highlight: {
    position: 'absolute',
    left: HIGHLIGHT_INSET,
    right: HIGHLIGHT_INSET,
    height: HIGHLIGHT_HEIGHT,
    borderRadius: CONTAINER_RADIUS,
    backgroundColor: colors.pink[50],
    borderWidth: 1,
    borderColor: colors.pink[200],
    top: HIGHLIGHT_OFFSET,
  },
  label: {
    height: 0,
    opacity: 0,
  },
});
