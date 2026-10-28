import React, { useEffect, useState } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { setTabBarBodyHeight } from './tabBarSpace';

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

// Se l'insieme delle voci cambia (es. Road acceso/spento mentre l'app è
// aperta) le voci scivolano al loro posto e la nuova entra in dissolvenza.
const TAB_LAYOUT = LinearTransition.duration(220).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.Never);
const TAB_IN = FadeIn.duration(220).reduceMotion(ReduceMotion.Never);
const TAB_OUT = FadeOut.duration(160).reduceMotion(ReduceMotion.Never);

const ACTIVE = '#111111';
const INACTIVE = '#9A9A9F';

/**
 * Istruttore (REG-638, «T1 piatta»): Agenda · Road · Allievi · Tu, glifi in
 * stile SF Symbols — contorno grigio a riposo, pieni neri sulla voce attiva.
 */
const INSTRUCTOR_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'calendar-outline',
  drive: 'map-outline',
  notes: 'people-outline',
  more: 'person-circle-outline',
};

/* ── Tab Item ── */

type TabItemProps = {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  iconOverride?: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
};

const TabItem = ({ routeName, label, isFocused, onPress, onPressIn, onPressOut, iconOverride, badgeCount = 0 }: TabItemProps) => {
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
    <Animated.View style={st.tabSlot} layout={TAB_LAYOUT} entering={TAB_IN} exiting={TAB_OUT}>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={st.tabItem}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={iconName}
          size={26}
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
    </Animated.View>
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

  // Voce toccata: si accende AL TOCCO, senza aspettare che la navigazione
  // renderizzi la schermata nuova (che può costare centinaia di ms sul thread
  // JS). Si spegne appena la navigazione è avvenuta o il tocco è annullato.
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  useEffect(() => setPressedKey(null), [state.index]);

  const bottomPad = Math.max(insets.bottom, 8);
  return (
    // «B · vetro a tutta larghezza» (Tiziano 28/10): la barra sta sopra le
    // schermate; dietro, su iOS il materiale sfocato di sistema, su Android un
    // bianco quasi pieno (il blur Android costa troppo). Niente riga dura.
    <View
      style={[st.bar, { paddingBottom: bottomPad }]}
      onLayout={(e) => setTabBarBodyHeight(e.nativeEvent.layout.height - bottomPad)}
    >
      {Platform.OS === 'ios' ? (
        <BlurView pointerEvents="none" tint="systemChromeMaterialLight" intensity={100} style={StyleSheet.absoluteFill} />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, Platform.OS === 'ios' ? st.veilIos : st.veilAndroid]} />
      <View pointerEvents="none" style={st.edge} />
      <View style={st.row}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === state.routes.findIndex((r) => r.key === route.key);
          const shownFocused = pressedKey ? pressedKey === route.key : isFocused;

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
          let tabIconOverride: keyof typeof Ionicons.glyphMap | undefined =
            instructorApp ? INSTRUCTOR_ICONS[route.name] : undefined;
          if (isStudentTeoria && route.name === 'home') {
            tabIconOverride = 'book-outline';
          } else if (isStudentMoto && route.name === 'home') {
            tabIconOverride = 'bicycle-outline';
          }

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              label={label}
              isFocused={shownFocused}
              onPress={onPress}
              onPressIn={() => setPressedKey(route.key)}
              onPressOut={() => setTimeout(() => setPressedKey((k) => (k === route.key ? null : k)), 0)}
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
  // «B · vetro a tutta larghezza»: sopra le schermate, il contenuto scorre sotto.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 7,
  },
  veilIos: { backgroundColor: 'rgba(255,255,255,0.55)' },
  veilAndroid: { backgroundColor: 'rgba(255,255,255,0.96)' },
  // Filo appena percettibile (era 0.14 e pieno): separa senza tagliare.
  edge: { position: 'absolute', left: 0, right: 0, top: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.08)' },
  row: {
    flexDirection: 'row',
  },
  tabSlot: { flex: 1 },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
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
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});
