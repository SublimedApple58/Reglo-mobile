import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DynamicColorIOS, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/context/SessionContext';
import { useAutoPaymentsEnabled } from '../../src/hooks/useAutoPaymentsEnabled';
import { colors } from '../../src/theme';

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

/* ── Android Tab Bar ── */

type AndroidTabBarExtraProps = {
  isOwner: boolean;
  showMoreTab: boolean;
};

const ANDROID_TAB_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; iconFocused: keyof typeof Ionicons.glyphMap }> = {
  home: { label: 'Home', icon: 'home-outline', iconFocused: 'home' },
  role: { label: 'Ruolo', icon: 'calendar-outline', iconFocused: 'calendar' },
  notes: { label: 'Note', icon: 'document-text-outline', iconFocused: 'document-text' },
  payments: { label: 'Pagamenti', icon: 'card-outline', iconFocused: 'card' },
  more: { label: 'Altro', icon: 'ellipsis-horizontal-circle-outline', iconFocused: 'ellipsis-horizontal-circle' },
  settings: { label: 'Impostazioni', icon: 'settings-outline', iconFocused: 'settings' },
};

const AndroidTabBar = ({
  state,
  descriptors,
  navigation,
  isOwner,
  showMoreTab,
}: BottomTabBarProps & AndroidTabBarExtraProps) => {
  const insets = useSafeAreaInsets();

  // Hide overflow tabs from the bar when "Altro" is shown
  const hiddenFromBar = showMoreTab ? new Set(['settings']) : new Set<string>();
  const visibleRoutes = state.routes.filter((route) => {
    if (hiddenFromBar.has(route.name)) return false;
    const options = descriptors[route.key]?.options;
    if ((options as { href?: string | null })?.href === null) return false;
    return true;
  });

  return (
    <View style={[styles.androidBarWrapper, { bottom: Math.max(8, insets.bottom + 6) }]}>
      <View style={styles.androidBar}>
        {visibleRoutes.map((route) => {
          const isFocused = state.index === state.routes.findIndex((r) => r.key === route.key);
          const meta = ANDROID_TAB_META[route.name];
          let label = meta?.label ?? route.name;
          if (route.name === 'role') {
            label = isOwner ? 'Istruttore' : 'Disponibilità';
          }
          const iconName = meta
            ? isFocused ? meta.iconFocused : meta.icon
            : 'help-outline';

          return (
            <AndroidTabItem
              key={route.key}
              routeKey={route.key}
              tabLabel={label}
              label={label}
              iconName={iconName}
              isFocused={isFocused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name as never);
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

/* ── Layout ── */

export default function TabsLayout() {
  const { autoscuolaRole } = useSession();
  const { enabled: autoPaymentsEnabled } = useAutoPaymentsEnabled();
  const showRoleTab = autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR';
  const showPaymentsTab = !showRoleTab && autoPaymentsEnabled;
  const showNotesTab = autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR';
  const showMoreTab = showRoleTab; // instructors/owners have >3 tabs, need "Altro"
  const isOwner = autoscuolaRole === 'OWNER';

  const transparent =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: 'transparent', dark: 'transparent' })
      : 'transparent';
  const defaultLabelColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: colors.textMuted, dark: colors.textMuted })
      : colors.textMuted;
  const selectedLabelColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: colors.primary, dark: colors.primary })
      : colors.primary;

  // Android: custom tab bar
  if (Platform.OS !== 'ios') {
    return (
      <Tabs
        tabBar={(props) => <AndroidTabBar {...props} isOwner={isOwner} showMoreTab={showMoreTab} />}
        screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="role" options={{ href: showRoleTab ? '/(tabs)/role' : null, title: isOwner ? 'Istruttore' : 'Disponibilità' }} />
        <Tabs.Screen name="notes" options={{ href: showNotesTab ? '/(tabs)/notes' : null, title: 'Note' }} />
        <Tabs.Screen name="more" options={{ href: showMoreTab ? '/(tabs)/more' : null, title: 'Altro' }} />
        <Tabs.Screen name="settings" options={{ title: 'Impostazioni' }} />
        <Tabs.Screen name="payments" options={{ href: showPaymentsTab ? '/(tabs)/payments' : null, title: 'Pagamenti' }} />
      </Tabs>
    );
  }

  // iOS: NativeTabs with liquid glass
  return (
    <NativeTabs
      iconColor={{ default: defaultLabelColor, selected: selectedLabelColor }}
      labelStyle={{
        default: { color: defaultLabelColor, fontSize: 11 },
        selected: { color: selectedLabelColor, fontSize: 11, fontWeight: '600' },
      }}
      tintColor={selectedLabelColor}
      backgroundColor={transparent}
      blurEffect="none"
      shadowColor={transparent}
      disableTransparentOnScrollEdge={false}
    >
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} drawable="ic_menu_view" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      {showRoleTab ? (
        <NativeTabs.Trigger name="role">
          <Icon
            sf={{ default: isOwner ? 'person.2' : 'clock', selected: isOwner ? 'person.2.fill' : 'clock' }}
            drawable="ic_menu_manage"
          />
          <Label>{isOwner ? 'Istruttore' : 'Disponibilità'}</Label>
        </NativeTabs.Trigger>
      ) : null}
      {showNotesTab ? (
        <NativeTabs.Trigger name="notes">
          <Icon sf={{ default: 'text.page', selected: 'text.page' }} drawable="ic_menu_view" />
          <Label>Note</Label>
        </NativeTabs.Trigger>
      ) : null}
      {showMoreTab ? (
        <NativeTabs.Trigger name="more">
          <Icon sf={{ default: 'line.3.horizontal', selected: 'line.3.horizontal' }} drawable="ic_menu_view" />
          <Label>Altro</Label>
        </NativeTabs.Trigger>
      ) : null}
      {showPaymentsTab ? (
        <NativeTabs.Trigger name="payments">
          <Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} drawable="ic_menu_view" />
          <Label>Pagamenti</Label>
        </NativeTabs.Trigger>
      ) : null}
      {!showMoreTab ? (
        <NativeTabs.Trigger name="settings">
          <Icon sf={{ default: 'slider.horizontal.3', selected: 'slider.horizontal.3' }} drawable="ic_menu_preferences" />
          <Label>Impostazioni</Label>
        </NativeTabs.Trigger>
      ) : null}
    </NativeTabs>
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
});
