import React, { useEffect } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

/* ── Icon map: outline (inactive) → filled (active) ── */

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'car-sport-outline',
  role: 'time-outline',
  notes: 'people-outline',
  swaps: 'repeat-outline',
  inbox: 'file-tray-outline',
  more: 'ellipsis-horizontal',
  settings: 'options-outline',
  quiz: 'school-outline',
};

/* Label overrides based on student phase context */
const LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  studentTeoria: {
    home: 'Quiz',
  },
};

/* ── Tab Item ── */

type TabItemProps = {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  iconOverride?: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
};

const TabItem = ({ routeName, label, isFocused, onPress, iconOverride, badgeCount = 0 }: TabItemProps) => {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.08]) }],
  }));

  const iconName = iconOverride ?? ICON_MAP[routeName] ?? 'ellipse-outline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={st.tabItem}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={iconName}
          size={22}
          color={isFocused ? colors.primary : colors.textMuted}
        />
        {badgeCount > 0 ? (
          <View style={st.badge}>
            <Text style={st.badgeText}>{badgeCount > 9 ? '9+' : String(badgeCount)}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Text
        style={[
          st.tabLabel,
          isFocused && st.tabLabelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};

/* ── Tab Bar ── */

type ExtraProps = {
  hiddenTabs: Set<string>;
  isOwner: boolean;
  isStudent: boolean;
  isStudentTeoria?: boolean;
  showMoreTab: boolean;
  showRoleTab: boolean;
};

export const GlassTabBar = ({
  state,
  descriptors,
  navigation,
  hiddenTabs,
  isOwner,
  isStudentTeoria,
  showRoleTab,
}: BottomTabBarProps & ExtraProps) => {
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadNotifications();

  const visibleRoutes = state.routes.filter((route) => !hiddenTabs.has(route.name));

  return (
    <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={st.row}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === state.routes.findIndex((r) => r.key === route.key);

          let label =
            options.tabBarLabel !== undefined
              ? String(options.tabBarLabel)
              : options.title !== undefined
                ? options.title
                : route.name;

          // Dynamic labels
          if (route.name === 'role') {
            label = isOwner ? 'Istruttore' : 'Disponibilità';
          }
          if (route.name === 'notes' && !showRoleTab) {
            label = 'Note';
          }
          // Context-aware label overrides
          if (isStudentTeoria && LABEL_OVERRIDES.studentTeoria[route.name]) {
            label = LABEL_OVERRIDES.studentTeoria[route.name];
          }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          // Context-aware icon overrides
          let tabIconOverride: keyof typeof Ionicons.glyphMap | undefined;
          if (isStudentTeoria && route.name === 'home') {
            tabIconOverride = 'book-outline';
          }

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              label={label}
              isFocused={isFocused}
              onPress={onPress}
              iconOverride={tabIconOverride}
              badgeCount={route.name === 'inbox' ? unreadCount : 0}
            />
          );
        })}
      </View>
    </View>
  );
};

/* ── Styles ── */

const st = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
