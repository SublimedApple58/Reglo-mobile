import React, { useEffect, useState } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
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
import { RoadMiniBar } from './road/RoadMiniBar';
import { useAnySheetOpen, useTabBarCovered } from './sheetPresence';
import { tabIconKey } from './tabIcons';
import { TAB_ICON_COLOR, TAB_ICON_OFF, TAB_ICON_OUTLINE, type TabIconKey } from '../theme/tabIconArt';

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
const INACTIVE = TAB_ICON_OFF;
/** Lato delle icone (come la barra nativa di iOS). */
const ICON = 27;

/* ── Tab Item ── */

type TabItemProps = {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  icon: TabIconKey;
  badgeCount?: number;
};

/**
 * REG-800: lo stesso set della barra nativa di iOS (`tabIconArt`): tratto
 * grigio a riposo, a colori quando la voce è accesa.
 */
const TabItem = ({ label, isFocused, onPress, onPressIn, onPressOut, icon, badgeCount = 0 }: TabItemProps) => {
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
        <SvgXml xml={isFocused ? TAB_ICON_COLOR[icon] : TAB_ICON_OUTLINE[icon]} width={ICON} height={ICON} color={INACTIVE} />
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
  showMoreTab: boolean;
  showRoleTab: boolean;
  /** App istruttore (anche titolare-istruttore): icone della «T1 piatta». */
  instructorApp?: boolean;
  /** Titolare o titolare-istruttore: «Oggi» e le icone dell'istruttore. */
  ownerApp?: boolean;
};

export const AppTabBar = ({
  state,
  descriptors,
  navigation,
  hiddenTabs,
  isOwner,
  isStudent,
  isStudentTeoria,
  showRoleTab,
  instructorApp,
  ownerApp,
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
  // Android: con un form sheet aperto la barra sparisce, come quando su iOS il
  // foglio la copre (altrimenti copriva la CTA del foglio). Vedi sheetPresence.
  // Agenda: la barra «Guida ⌄ · Continua» del blocco fantasma prende il suo
  // posto (iOS e Android): sfuma e scende di 10 pt, poi torna.
  const sheetOpen = useAnySheetOpen();
  const covered = useTabBarCovered();
  const hidden = sheetOpen || covered;
  const hideStyle = useAnimatedStyle(() => ({
    opacity: withTiming(hidden ? 0 : 1, { duration: hidden ? 150 : 200, reduceMotion: ReduceMotion.Never }),
    transform: [{ translateY: withTiming(covered ? 10 : 0, { duration: covered ? 150 : 220, reduceMotion: ReduceMotion.Never }) }],
  }));
  return (
    // «B · vetro a tutta larghezza» (Tiziano 28/10): la barra sta sopra le
    // schermate; dietro, su iOS il materiale sfocato di sistema, su Android un
    // bianco quasi pieno (il blur Android costa troppo). Niente riga dura.
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[st.bar, { paddingBottom: bottomPad }, hideStyle]}
      onLayout={(e) => setTabBarBodyHeight(e.nativeEvent.layout.height - bottomPad)}
    >
      {Platform.OS === 'ios' ? (
        <BlurView pointerEvents="none" tint="systemChromeMaterialLight" intensity={100} style={StyleSheet.absoluteFill} />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, Platform.OS === 'ios' ? st.veilIos : st.veilAndroid]} />
      <View pointerEvents="none" style={st.edge} />
      {/* REG-700: guida in corso con Road ridotta → «Torna in Road» sopra le voci. */}
      {instructorApp ? <RoadMiniBar /> : null}
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

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              label={label}
              isFocused={shownFocused}
              onPress={onPress}
              onPressIn={() => setPressedKey(route.key)}
              onPressOut={() => setTimeout(() => setPressedKey((k) => (k === route.key ? null : k)), 0)}
              icon={tabIconKey(route.name, { staffApp: !!(instructorApp || ownerApp), studentTeoria: !!isStudentTeoria })}
              badgeCount={route.name === 'inbox' ? unreadCount : 0}
            />
          );
        })}
      </View>
    </Animated.View>
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
