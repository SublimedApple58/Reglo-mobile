import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/context/SessionContext';
import { useAutoPaymentsEnabled } from '../../src/hooks/useAutoPaymentsEnabled';
import { colors } from '../../src/theme';

/* ── Helpers ── */

type TabDef = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  sfIcon?: { default: string; selected: string };
};

const MAX_VISIBLE_TABS = 4; // 3 primary + 1 "Altro"

const resolveTabDefs = (
  showRoleTab: boolean,
  showPaymentsTab: boolean,
  showVehiclesTab: boolean,
  showNotesTab: boolean,
  isOwner: boolean,
): TabDef[] => {
  const tabs: TabDef[] = [
    {
      name: 'home',
      label: 'Home',
      icon: 'home-outline',
      iconFocused: 'home',
      sfIcon: { default: 'house', selected: 'house.fill' },
    },
  ];
  if (showRoleTab) {
    tabs.push({
      name: 'role',
      label: isOwner ? 'Istruttore' : 'Disponibilità',
      icon: isOwner ? 'speedometer-outline' : 'calendar-outline',
      iconFocused: isOwner ? 'speedometer' : 'calendar',
      sfIcon: {
        default: isOwner ? 'speedometer' : 'calendar',
        selected: isOwner ? 'speedometer' : 'calendar',
      },
    });
  }
  if (showNotesTab) {
    tabs.push({
      name: 'notes',
      label: 'Note',
      icon: 'document-text-outline',
      iconFocused: 'document-text',
      sfIcon: { default: 'doc.text', selected: 'doc.text.fill' },
    });
  }
  if (showVehiclesTab) {
    tabs.push({
      name: 'vehicles',
      label: 'Veicoli',
      icon: 'car-outline',
      iconFocused: 'car',
      sfIcon: { default: 'car', selected: 'car.fill' },
    });
  }
  if (showPaymentsTab) {
    tabs.push({
      name: 'payments',
      label: 'Pagamenti',
      icon: 'card-outline',
      iconFocused: 'card',
      sfIcon: { default: 'creditcard', selected: 'creditcard.fill' },
    });
  }
  tabs.push({
    name: 'settings',
    label: 'Impostazioni',
    icon: 'settings-outline',
    iconFocused: 'settings',
    sfIcon: { default: 'gearshape', selected: 'gearshape.fill' },
  });
  return tabs;
};

/* ── Android Tab Item ── */

type AndroidTabItemProps = {
  routeKey: string;
  tabLabel: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  isFocused: boolean;
  onPress: () => void;
};

const AndroidTabItem = ({ routeKey, tabLabel, label, iconName, isFocused, onPress }: AndroidTabItemProps) => {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, progress]);

  const activeFillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.94, 1]) }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -1]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.03]) },
    ],
    opacity: interpolate(progress.value, [0, 1], [0.88, 1]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.86, 1]),
  }));

  return (
    <Pressable
      key={routeKey}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={tabLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.androidTabItem, pressed && styles.androidTabItemPressed]}
    >
      <Animated.View pointerEvents="none" style={[styles.androidActiveFill, activeFillStyle]} />
      <Animated.View style={[styles.androidTabContent, contentStyle]}>
        <Ionicons name={iconName} size={20} color={isFocused ? '#FFFFFF' : colors.textSecondary} style={styles.androidTabIcon} />
        <Animated.Text style={[styles.androidTabLabel, isFocused && styles.androidTabLabelActive, labelStyle]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
};

/* ── Overflow Menu Modal ── */

type OverflowMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; active: boolean }>;
};

const OverflowMenu = ({ visible, onClose, items }: OverflowMenuProps) => {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overflowBackdrop} onPress={onClose}>
        <View style={[styles.overflowSheet, { bottom: 90 + Math.max(insets.bottom, 8) }]}>
          {items.map((item) => (
            <Pressable
              key={item.label}
              style={[styles.overflowItem, item.active && styles.overflowItemActive]}
              onPress={() => {
                onClose();
                item.onPress();
              }}
            >
              <Ionicons name={item.icon} size={20} color={item.active ? '#EC4899' : '#64748B'} />
              <Text style={[styles.overflowLabel, item.active && styles.overflowLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
};

/* ── Android Tab Bar ── */

type AndroidTabBarExtraProps = {
  tabDefs: TabDef[];
};

const AndroidTabBar = ({
  state,
  descriptors,
  navigation,
  tabDefs,
}: BottomTabBarProps & AndroidTabBarExtraProps) => {
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);

  const allRoutes = state.routes.filter((route) =>
    tabDefs.some((t) => t.name === route.name),
  );

  const needsOverflow = tabDefs.length > MAX_VISIBLE_TABS;
  const primaryDefs = needsOverflow ? tabDefs.slice(0, MAX_VISIBLE_TABS - 1) : tabDefs;
  const overflowDefs = needsOverflow ? tabDefs.slice(MAX_VISIBLE_TABS - 1) : [];

  const overflowNames = new Set(overflowDefs.map((d) => d.name));
  const currentRouteName = state.routes[state.index]?.name;
  const isOverflowActive = overflowNames.has(currentRouteName);

  const primaryRoutes = allRoutes.filter((r) => primaryDefs.some((d) => d.name === r.name));

  return (
    <>
      <OverflowMenu
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={overflowDefs.map((def) => ({
          label: def.label,
          icon: currentRouteName === def.name ? def.iconFocused : def.icon,
          active: currentRouteName === def.name,
          onPress: () => navigation.navigate(def.name as never),
        }))}
      />
      <View style={[styles.androidBarWrapper, { bottom: Math.max(8, insets.bottom + 6) }]}>
        <View style={styles.androidBar}>
          {primaryRoutes.map((route) => {
            const def = tabDefs.find((d) => d.name === route.name)!;
            const isFocused = state.index === state.routes.findIndex((r) => r.key === route.key);
            return (
              <AndroidTabItem
                key={route.key}
                routeKey={route.key}
                tabLabel={def.label}
                label={def.label}
                iconName={isFocused ? def.iconFocused : def.icon}
                isFocused={isFocused}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name as never);
                }}
              />
            );
          })}
          {needsOverflow ? (
            <AndroidTabItem
              routeKey="__more__"
              tabLabel="Altro"
              label="Altro"
              iconName={isOverflowActive ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
              isFocused={isOverflowActive}
              onPress={() => setMoreOpen(true)}
            />
          ) : null}
        </View>
      </View>
    </>
  );
};

/* ── Layout ── */

export default function TabsLayout() {
  const { autoscuolaRole } = useSession();
  const { enabled: autoPaymentsEnabled } = useAutoPaymentsEnabled();
  const showRoleTab = autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR';
  const showPaymentsTab = !showRoleTab && autoPaymentsEnabled;
  const showVehiclesTab = autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR';
  const showNotesTab = autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR';
  const isOwner = autoscuolaRole === 'OWNER';

  const tabDefs = useMemo(
    () => resolveTabDefs(showRoleTab, showPaymentsTab, showVehiclesTab, showNotesTab, isOwner),
    [showRoleTab, showPaymentsTab, showVehiclesTab, showNotesTab, isOwner],
  );

  const needsOverflow = tabDefs.length > MAX_VISIBLE_TABS;
  const primaryDefs = needsOverflow ? tabDefs.slice(0, MAX_VISIBLE_TABS - 1) : tabDefs;
  const overflowDefs = needsOverflow ? tabDefs.slice(MAX_VISIBLE_TABS - 1) : [];

  return (
    <Tabs
      tabBar={(props) => <AndroidTabBar {...props} tabDefs={tabDefs} />}
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="role" options={{ href: showRoleTab ? '/(tabs)/role' : null, title: isOwner ? 'Istruttore' : 'Disponibilità' }} />
      <Tabs.Screen name="notes" options={{ href: showNotesTab ? '/(tabs)/notes' : null, title: 'Note' }} />
      <Tabs.Screen name="vehicles" options={{ href: showVehiclesTab ? '/(tabs)/vehicles' : null, title: 'Veicoli' }} />
      <Tabs.Screen name="payments" options={{ href: showPaymentsTab ? '/(tabs)/payments' : null, title: 'Pagamenti' }} />
      <Tabs.Screen name="settings" options={{ title: 'Impostazioni' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  androidBarWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  androidBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 70,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 9,
  },
  androidTabItem: {
    flex: 1,
    height: '100%',
    borderRadius: 22,
    overflow: 'hidden',
  },
  androidTabItemPressed: {
    transform: [{ scale: 0.97 }],
  },
  androidActiveFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    backgroundColor: colors.primary,
  },
  androidTabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  androidTabIcon: {
    zIndex: 2,
  },
  androidTabLabel: {
    zIndex: 2,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  androidTabLabelActive: {
    color: '#FFFFFF',
  },
  overflowBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  overflowSheet: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 200,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  overflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  overflowItemActive: {
    backgroundColor: '#FCE7F3',
  },
  overflowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  overflowLabelActive: {
    color: '#EC4899',
    fontWeight: '700',
  },
});
