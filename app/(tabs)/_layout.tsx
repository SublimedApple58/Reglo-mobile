import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { DynamicColorIOS, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/context/SessionContext';
import { useAutoPaymentsEnabled } from '../../src/hooks/useAutoPaymentsEnabled';
import { colors } from '../../src/theme';

type AndroidTabBarExtraProps = {
  showRoleTab: boolean;
  showPaymentsTab: boolean;
  isOwner: boolean;
};

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
      <Animated.View pointerEvents="none" style={[styles.androidActiveFill, activeFillStyle]}>
        <LinearGradient
          colors={['#324D7A', '#2B436A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.androidTabContent, contentStyle]}>
        <Ionicons name={iconName} size={20} color={isFocused ? '#FFFFFF' : colors.textSecondary} style={styles.androidTabIcon} />
        <Animated.Text style={[styles.androidTabLabel, isFocused && styles.androidTabLabelActive, labelStyle]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
};

const AndroidTabBar = ({
  state,
  descriptors,
  navigation,
  showRoleTab,
  showPaymentsTab,
  isOwner,
}: BottomTabBarProps & AndroidTabBarExtraProps) => {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route) => {
    if (route.name === 'role') return showRoleTab;
    if (route.name === 'payments') return showPaymentsTab;
    return true;
  });
  if (!visibleRoutes.length) return null;

  return (
    <View style={[styles.androidBarWrapper, { bottom: Math.max(8, insets.bottom + 6) }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.98)', 'rgba(243,250,247,0.97)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.androidBar}
      >
        {visibleRoutes.map((route) => {
          const descriptor = descriptors[route.key];
          const isFocused = state.index === state.routes.findIndex((item) => item.key === route.key);
          const tabLabel = descriptor.options.title ?? route.name;
          const label =
            route.name === 'role'
              ? isOwner
                ? 'Istruttore'
                : 'Gestione'
              : route.name === 'payments'
                ? 'Pagamenti'
              : route.name === 'settings'
                ? 'Impostazioni'
                : 'Home';

          const iconName: keyof typeof Ionicons.glyphMap =
            route.name === 'role'
              ? isOwner
                ? isFocused
                  ? 'speedometer'
                  : 'speedometer-outline'
                : isFocused
                  ? 'car-sport'
                  : 'car-sport-outline'
              : route.name === 'payments'
                ? isFocused
                  ? 'card'
                  : 'card-outline'
              : route.name === 'settings'
                ? isFocused
                  ? 'settings'
                  : 'settings-outline'
                : isFocused
                  ? 'home'
                  : 'home-outline';

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

          return (
            <AndroidTabItem
              key={route.key}
              routeKey={route.key}
              tabLabel={String(tabLabel)}
              label={label}
              iconName={iconName}
              isFocused={isFocused}
              onPress={onPress}
            />
          );
        })}
      </LinearGradient>
    </View>
  );
};

export default function TabsLayout() {
  const { autoscuolaRole } = useSession();
  const { enabled: autoPaymentsEnabled } = useAutoPaymentsEnabled();
  const showRoleTab = autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR';
  const showPaymentsTab = !showRoleTab && autoPaymentsEnabled;
  const isOwner = autoscuolaRole === 'OWNER';

  const transparent =
    Platform.OS === 'ios'
      ? DynamicColorIOS({
          light: 'transparent',
          dark: 'transparent',
        })
      : 'transparent';
  const defaultLabelColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({
          light: colors.textMuted,
          dark: colors.textMuted,
        })
      : colors.textMuted;
  const selectedLabelColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({
          light: colors.navy,
          dark: colors.navy,
        })
      : colors.navy;

  if (Platform.OS !== 'ios') {
    return (
      <Tabs
        tabBar={(props) => (
          <AndroidTabBar
            {...props}
            showRoleTab={showRoleTab}
            showPaymentsTab={showPaymentsTab}
            isOwner={isOwner}
          />
        )}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="role"
          options={{
            href: showRoleTab ? '/(tabs)/role' : null,
            title: isOwner ? 'Istruttore' : 'Gestione',
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            href: showPaymentsTab ? '/(tabs)/payments' : null,
            title: 'Pagamenti',
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Impostazioni',
          }}
        />
      </Tabs>
    );
  }

  return (
    <NativeTabs
      iconColor={{
        default: defaultLabelColor,
        selected: selectedLabelColor,
      }}
      labelStyle={{
        default: { color: defaultLabelColor, fontSize: 11 },
        selected: { color: selectedLabelColor, fontSize: 11, fontWeight: '600' },
      }}
      tintColor={selectedLabelColor}
      backgroundColor={Platform.OS === 'ios' ? transparent : colors.backgroundTop}
      blurEffect={Platform.OS === 'ios' ? 'none' : undefined}
      shadowColor={Platform.OS === 'ios' ? transparent : undefined}
      disableTransparentOnScrollEdge={Platform.OS === 'ios' ? false : undefined}
    >
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} drawable="ic_menu_view" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      {showRoleTab ? (
        <NativeTabs.Trigger name="role">
          <Icon
            sf={{ default: isOwner ? 'speedometer' : 'car', selected: isOwner ? 'speedometer' : 'car.fill' }}
            drawable="ic_menu_manage"
          />
          <Label>{isOwner ? 'Istruttore' : 'Gestione'}</Label>
        </NativeTabs.Trigger>
      ) : null}
      {showPaymentsTab ? (
        <NativeTabs.Trigger name="payments">
          <Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} drawable="ic_menu_view" />
          <Label>Pagamenti</Label>
        </NativeTabs.Trigger>
      ) : null}
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} drawable="ic_menu_preferences" />
        <Label>Impostazioni</Label>
      </NativeTabs.Trigger>
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
    borderColor: 'rgba(50, 77, 122, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: 'rgba(20, 36, 61, 0.22)',
    shadowOpacity: 0.22,
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
