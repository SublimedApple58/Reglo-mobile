import React, { useEffect } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
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
  drive: 'map-outline',
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

const ACTIVE = '#111111';
const INACTIVE = '#8E8E93';

/** Altezza del contenuto della barra (senza safe area): serve a chi ci sta sotto (tab Road). */
export const TAB_BAR_CONTENT_H = 53;

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

  const outline = iconOverride ?? ICON_MAP[routeName] ?? 'ellipse-outline';
  // Come le tab bar native: contorno a riposo, pieno quando è attiva.
  const filled = outline.replace(/-outline$/, '') as keyof typeof Ionicons.glyphMap;
  const iconName = isFocused && filled in Ionicons.glyphMap ? filled : outline;

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
          size={25}
          color={isFocused ? ACTIVE : INACTIVE}
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

/**
 * Tab centrale in rilievo (REG-638, scelta B): cerchio nero con un glifo
 * monocromatico bianco (freccia di navigazione, come le altre icone della
 * barra), etichetta sotto come le altre.
 */
const CenterTabItem = ({ label, isFocused, onPress }: { label: string; isFocused: boolean; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: isFocused }}
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [st.tabItem, pressed && { opacity: 0.85 }]}
    testID="tab-center-road"
  >
    <View style={st.fab}>
      <Ionicons name="navigate" size={25} color="#FFFFFF" style={st.fabIcon} />
    </View>
    <Text style={[st.tabLabel, st.fabLabel, isFocused && st.tabLabelActive]} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

/* ── Tab Bar ── */

type ExtraProps = {
  hiddenTabs: Set<string>;
  isOwner: boolean;
  isStudent: boolean;
  isStudentTeoria?: boolean;
  /** Student on a motorcycle path (license AM | A1 | A2 | A) → moto Home icon. */
  isStudentMoto?: boolean;
  showMoreTab: boolean;
  showRoleTab: boolean;
  /** Tab disegnata al centro in rilievo (istruttore con Road: «drive»). */
  centerRoute?: string;
};

export const GlassTabBar = ({
  state,
  descriptors,
  navigation,
  hiddenTabs,
  isOwner,
  isStudentTeoria,
  isStudentMoto,
  showRoleTab,
  centerRoute,
}: BottomTabBarProps & ExtraProps) => {
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadNotifications();

  const visibleRoutes = state.routes.filter((route) => !hiddenTabs.has(route.name));
  // Tab Road: la mappa continua sotto la barra di vetro (barra sovrapposta).
  const floating = state.routes[state.index]?.name === 'drive';

  return (
    <View style={[st.bar, floating && st.barFloating, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {Platform.OS === 'ios' ? (
        <BlurView tint="systemChromeMaterialLight" intensity={100} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, st.barSolid]} />
      )}
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

          // Context-aware icon overrides. Teoria wins (Home = quiz); otherwise a
          // moto student gets a moto-flavoured Home icon. Ionicons has no
          // "motorcycle", so we reuse the instructor-side moto proxy.
          let tabIconOverride: keyof typeof Ionicons.glyphMap | undefined;
          if (isStudentTeoria && route.name === 'home') {
            tabIconOverride = 'book-outline';
          } else if (isStudentMoto && route.name === 'home') {
            tabIconOverride = 'bicycle-outline';
          }

          if (route.name === centerRoute) {
            return <CenterTabItem key={route.key} label={label} isFocused={isFocused} onPress={onPress} />;
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
  // Barra nativa: vetro di sistema su iOS, filo sottile in alto, niente ombre.
  bar: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(250,250,250,0.6)' : colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.16)',
    paddingTop: 7,
  },
  barFloating: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  barSolid: { backgroundColor: 'rgba(250,250,250,0.97)' },
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
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginTop: -27,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FAFAFA',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  // la freccia di Ionicons è disegnata spostata: la si rimette al centro ottico
  fabIcon: { marginLeft: -2, marginTop: 2 },
  fabLabel: { marginTop: -1 },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: INACTIVE,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: ACTIVE,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#C13515',
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
