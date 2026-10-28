import React, { useEffect } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import type { Icon3DName } from '../theme/icons3d';
import { Icon3D } from './clay/Icon3D';

/* ── Icone 3D colorate per voce (clay v2, REG-639) ── */

const ICON_MAP: Record<string, Icon3DName> = {
  home: 'car',
  role: 'clock',
  notes: 'people',
  swaps: 'swap',
  inbox: 'bell',
  drive: 'road',
  more: 'profile',
  settings: 'profile',
  quiz: 'exam',
};

/* Label overrides based on student phase context */
const LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  studentTeoria: {
    home: 'Quiz',
  },
};

/** Istruttore e titolare-istruttore: Agenda · Road · Allievi · Tu. */
const INSTRUCTOR_ICONS: Record<string, Icon3DName> = {
  home: 'agenda',
  drive: 'road',
  notes: 'people',
  more: 'profile',
};

/* ── Tab Item ── */

type TabItemProps = {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  iconOverride?: Icon3DName;
  badgeCount?: number;
};

const FADE = { duration: 200, easing: Easing.out(Easing.cubic) };

/**
 * Voce della tab bar clay: icona 3D colorata + etichetta. La voce attiva è una
 * bolla bianca in rilievo (`raiseSm`) che compare morbida; le altre hanno
 * l'icona appena più tenue e l'etichetta grigia. Si anima solo opacità/scala,
 * mai l'ombra.
 */
const TabItem = ({ routeName, label, isFocused, onPress, iconOverride, badgeCount = 0 }: TabItemProps) => {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, FADE);
  }, [isFocused, progress]);

  const bubble = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));
  const icon = useAnimatedStyle(() => ({ opacity: 0.78 + progress.value * 0.22 }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={st.tabItem}
    >
      <Animated.View pointerEvents="none" style={[st.bubble, CLAY_SHADOW.raiseSm, bubble]} />
      <Animated.View style={icon}>
        <Icon3D name={iconOverride ?? ICON_MAP[routeName] ?? 'memo'} size={28} />
        {badgeCount > 0 ? (
          <View style={st.badge}>
            <Text style={st.badgeText}>{badgeCount > 9 ? '9+' : String(badgeCount)}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Text style={[st.tabLabel, isFocused && st.tabLabelActive]} numberOfLines={1}>
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
  /** Student on a motorcycle path (license AM | A1 | A2 | A) → moto Home icon. */
  isStudentMoto?: boolean;
  showMoreTab: boolean;
  showRoleTab: boolean;
  /** App istruttore (anche titolare-istruttore): icone della «T1 piatta». */
  instructorApp?: boolean;
};

export const AppTabBar = ({
  state,
  descriptors,
  navigation,
  hiddenTabs,
  isOwner,
  isStudentTeoria,
  isStudentMoto,
  showRoleTab,
  instructorApp,
}: BottomTabBarProps & ExtraProps) => {
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadNotifications();

  const visibleRoutes = state.routes.filter((route) => !hiddenTabs.has(route.name));

  return (
    <View style={[st.bar, { paddingBottom: Math.max(insets.bottom - 6, 10) }]}>
      <View style={[st.row, CLAY_SHADOW.raise]}>
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
          // moto student gets the 3D motorcycle on Home.
          let tabIconOverride: Icon3DName | undefined = instructorApp ? INSTRUCTOR_ICONS[route.name] : undefined;
          if (isStudentTeoria && route.name === 'home') {
            tabIconOverride = 'book';
          } else if (isStudentMoto && route.name === 'home') {
            tabIconOverride = 'motorcycle';
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
  // Clay v2: capsula bianca in rilievo, staccata dai bordi, sopra un fondo
  // bianco pieno (il contenuto non ci passa sotto: niente vetro, niente blur).
  bar: {
    backgroundColor: CLAY.bg,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    height: 66,
    borderRadius: 33,
    paddingHorizontal: 5,
    alignItems: 'center',
    backgroundColor: CLAY.surface,
  },
  tabItem: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bubble: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: CLAY.surface,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: CLAY.ink3,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: CLAY.ink,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#C13515',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
