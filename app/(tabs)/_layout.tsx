import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Badge, Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/context/SessionContext';
import { useSwapEnabled } from '../../src/hooks/useSwapEnabled';
import { useVehiclesEnabled } from '../../src/hooks/useVehiclesEnabled';
import { useQuizEnabled } from '../../src/hooks/useQuizEnabled';
import { QuizProvider } from '../../src/context/QuizContext';
import { useStudentPhase } from '../../src/hooks/useStudentPhase';
import { NotificationOverlay } from '../../src/components/NotificationOverlay';
import { AppTabBar } from '../../src/components/AppTabBar';
import { LicensePathGateScreen } from '../../src/screens/LicensePathGateScreen';
import { isInstructor as isInstructorRole, isOwner as isOwnerRole, isStudent as isStudentRole } from '../../src/utils/roles';
import { useInstructorTabs } from '../../src/hooks/useInstructorTabs';
import { warmRoadFree } from '../../src/road/freeStartStore';
import {
  setTabBarMiniHeight,
  TabSceneContext,
  useNativeTabBarBase,
  useTabBarHeight,
  type TabBarKind,
} from '../../src/components/tabBarSpace';
import { TAB_ICON_PNG, tabIconKey } from '../../src/components/tabIcons';
import { TAB_ICON_OFF } from '../../src/theme/tabIconArt';
import { RoadMiniBar } from '../../src/components/road/RoadMiniBar';
import { useUnreadNotifications } from '../../src/hooks/useUnreadNotifications';

/**
 * Tab bar «B · vetro» (Tiziano 28/10): la barra sta sopra le schermate. Solo le
 * radici dell'app istruttore scorrono sotto il vetro (si tengono lo spazio da
 * sé, `useTabBarOverlap`); qualsiasi pagina a schermo pieno aperta sopra ha lo
 * spazio riservato qui. I fogli (form sheet, modali) non contano: aprirli non
 * cambia il layout della radice sotto.
 */
const UNDER_GLASS_TABS = new Set(['today', 'home', 'drive', 'notes', 'more']);
const FULL_PAGES = new Set([
  'availability', 'notifications', 'swaps', 'group-lesson-invites',
  'cluster-settings',
  // REG-646: punti critici nella tab Road.
  'punti-critici',
  'settings', 'appearance', 'instructor-hours', 'locations', 'vehicles', 'evaluation-sheet',
]);

type NestedState = { routes?: { name: string }[]; index?: number } | undefined;

/** La pagina «di carta» in cima alla pila della tab (ignora fogli e modali). */
function topPageIsRoot(state: NestedState): boolean {
  const routes = state?.routes ?? [];
  const top = Math.min(state?.index ?? routes.length - 1, routes.length - 1);
  for (let i = top; i >= 0; i -= 1) {
    const name = routes[i]?.name;
    if (name === 'index') return true;
    if (name && FULL_PAGES.has(name)) return false;
  }
  return true;
}


/** Ordine delle voci (e prima voce visibile = tab d'avvio). */
const TAB_ORDER = ['today', 'home', 'guide', 'swaps', 'role', 'drive', 'notes', 'more', 'settings', 'quiz', 'inbox'] as const;

/**
 * REG-800 — iOS: la «Torna in Road» (REG-700) galleggia sopra la barra nativa,
 * che non può ospitarla (niente `bottomAccessory` in SDK 54). La sua altezza
 * entra nello spazio che le schermate si tengono in fondo.
 */
function NativeRoadMiniBar() {
  const base = useNativeTabBarBase();
  React.useEffect(() => () => setTabBarMiniHeight(0), []);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, st.miniWrap, { paddingBottom: base }]}>
      <View onLayout={(e) => setTabBarMiniHeight(e.nativeEvent.layout.height)}>
        <RoadMiniBar />
      </View>
    </View>
  );
}

/* ── Layout ── */

export default function TabsLayout() {
  const { autoscuolaRole, status } = useSession();
  const { enabled: swapEnabled } = useSwapEnabled();
  const { enabled: vehiclesEnabled } = useVehiclesEnabled();
  const { enabled: quizEnabled } = useQuizEnabled();
  const { phase: studentPhase, hasQuizAccess, needsLicensePath } = useStudentPhase();
  const showRoleTab = isOwnerRole(autoscuolaRole) || isInstructorRole(autoscuolaRole);
  const isStudent = isStudentRole(autoscuolaRole);
  const isInstructor = isInstructorRole(autoscuolaRole);
  const isInstructorOwner = autoscuolaRole === 'INSTRUCTOR_OWNER';
  const isStudentAwaiting = isStudent && studentPhase === 'AWAITING';
  const isStudentInTeoria = isStudent && studentPhase === 'TEORIA';
  const isStudentLicensed = isStudent && studentPhase === 'PATENTATO';
  // Students in AWAITING: only the home neutral screen — no functional tabs.
  // Students in PATENTATO: only home tab is visible.
  // Students in TEORIA: quiz central, no swaps.
  // REG-786: la tab Note dell'allievo è diventata «Come stai andando» nella tab Guide.
  const showNotesTab = showRoleTab;
  // REG-794 (rilascio 2): titolare e titolare-istruttore hanno «Oggi» per
  // prima tab; via le tab Istruttore e Notifiche (la campanella è in testa a
  // «Oggi»); Altro e Impostazioni stanno in «Tu», come per l'istruttore.
  const ownerApp = isOwnerRole(autoscuolaRole);
  // «Tu»: istruttori (Ore di guida) e titolari (veicoli, luoghi, impostazioni).
  const showMoreTab = isInstructor || isInstructorOwner || ownerApp;
  // Quiz tab: hidden for TEORIA students (quiz is integrated into the home).
  // Kept visible only for future phases that may need a standalone quiz tab.
  const showQuizTab = false;
  // Notifications inbox tab: instructors/owners always; students except those in
  // AWAITING / PATENTATO (who see only home). Shows a red count pill when unread.
  // REG-638 «T1 piatta»: istruttore → Agenda · Road · Allievi · Tu. Disponibilità
  // e Notifiche si aprono da orologio e campanella nell'intestazione dell'Agenda.
  const { instructorApp, showRoad: showDriveTab } = useInstructorTabs();
  // Road pronta prima del tocco: opzioni e foto dei volti in background.
  React.useEffect(() => {
    if (showDriveTab) warmRoadFree();
  }, [showDriveTab]);
  // REG-786 (V1, Tiziano 24/11): l'allievo in pratica ha Home · Guide · Scambi ·
  // Profilo. Le notifiche restano nella campanella della home, le note
  // («Come stai andando») stanno nella tab Guide.
  const isStudentDriving = isStudent && !isStudentAwaiting && !isStudentLicensed && !isStudentInTeoria;
  const showGuideTab = isStudentDriving;
  const showSwapsTab = isStudentDriving && swapEnabled;
  const showInboxTab =
    !instructorApp && !ownerApp && (showRoleTab || (isStudent && !isStudentAwaiting && !isStudentLicensed && !isStudentDriving));
  const isOwner = autoscuolaRole === 'OWNER';
  const tabBarHeight = useTabBarHeight();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadNotifications();

  // Compute hidden tabs explicitly so the Android custom tab bar can
  // filter reliably (expo-router descriptors don't update reactively).
  const hiddenTabs = React.useMemo(() => {
    const set = new Set<string>();
    if (!ownerApp) set.add('today');
    // «Istruttore» (titolare) e «Disponibilità» non sono più tab: la parte utile
    // è in «Oggi» e nell'orologio dell'Agenda.
    if (!showRoleTab || instructorApp || ownerApp) set.add('role');
    if (!showNotesTab) set.add('notes');
    if (!showMoreTab) set.add('more');
    if (!showQuizTab) set.add('quiz');
    if (!showInboxTab) set.add('inbox');
    if (!showDriveTab) set.add('drive');
    if (!showGuideTab) set.add('guide');
    if (!showSwapsTab) set.add('swaps');
    // Settings hidden when "Altro" is shown (accessed from More screen)
    if (showMoreTab) set.add('settings');
    // Awaiting / Licensed students see only home — no settings either.
    if (isStudentAwaiting || isStudentLicensed) set.add('settings');
    return set;
  }, [
    ownerApp,
    showRoleTab,
    showNotesTab,
    showMoreTab,
    showQuizTab,
    showInboxTab,
    showDriveTab,
    showGuideTab,
    showSwapsTab,
    instructorApp,
    isStudentAwaiting,
    isStudentLicensed,
  ]);

  // REG-800: quale barra. Una sola voce (allievo in attesa o patentato) =
  // niente barra; su iOS la barra di sistema (Liquid Glass), su Android la
  // nostra barra JS con le stesse icone.
  const visibleTabs = TAB_ORDER.filter((name) => !hiddenTabs.has(name));
  const wantedKind: TabBarKind = visibleTabs.length <= 1 ? 'none' : Platform.OS === 'ios' ? 'native' : 'js';
  // La barra nativa, una volta montata, resta fino al prossimo avvio: smontarla
  // ad app aperta (es. allievo che passa in attesa) manda react-native-screens
  // in errore («Expected exactly 1 focused tab», REG-800). Con una voce sola
  // resta la sola Home finché l'app non si riapre.
  const nativeShown = React.useRef(false);
  if (wantedKind === 'native') nativeShown.current = true;
  const barKind: TabBarKind = nativeShown.current && wantedKind === 'none' ? 'native' : wantedKind;
  // iOS: radici che scorrono sotto il vetro (si tengono lo spazio da sé con
  // `useTabBarOverlap`).
  const sceneInfo = React.useMemo(() => {
    const underGlass = new Set(['today', 'drive', 'notes', 'more', 'guide', 'swaps']);
    // La Home dell'allievo in teoria (Quiz), in attesa o patentato non ci scorre sotto.
    if (!isStudentInTeoria && !isStudentAwaiting && !isStudentLicensed) underGlass.add('home');
    return { kind: barKind, underGlass };
  }, [barKind, isStudentInTeoria, isStudentAwaiting, isStudentLicensed]);
  const staffApp = instructorApp || ownerApp;
  const titleFor = (name: (typeof TAB_ORDER)[number]): string => {
    switch (name) {
      case 'today': return 'Oggi';
      case 'home': return staffApp ? 'Agenda' : isStudentInTeoria ? 'Quiz' : 'Home';
      case 'guide': return 'Guide';
      case 'swaps': return 'Scambi';
      case 'role': return isOwner ? 'Istruttore' : 'Disponibilità';
      case 'drive': return 'Road';
      case 'notes': return showRoleTab ? 'Allievi' : 'Note';
      case 'more': return staffApp ? 'Tu' : 'Altro';
      case 'settings': return isStudent ? 'Profilo' : 'Impostazioni';
      case 'quiz': return 'Quiz';
      case 'inbox': return 'Notifiche';
    }
  };

  // REG-802: il cellulare mancante (era il PhoneGate) lo chiede l'onboarding
  // (`app/onboarding`), dove l'AuthGate porta finché `/me` ha degli step.

  // Blocking gate: a student who registered in autonomy (self sign-up) must
  // pick their own percorso patente at first access (REG-410). Shown after the
  // onboarding (REG-802); same rules — replaces the tab tree, only exits are confirm/logout.
  if (status === 'ready' && isStudent && needsLicensePath) {
    return <LicensePathGateScreen />;
  }

  const overlay = (
    <NotificationOverlay
      isStudent={isStudent}
      isInstructor={isInstructor}
      isOwner={autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR_OWNER'}
      swapEnabled={swapEnabled}
    />
  );

  if (barKind === 'native') {
    const iconCtx = { staffApp, studentTeoria: isStudentInTeoria };
    return (
      <QuizProvider>
        <TabSceneContext.Provider value={sceneInfo}>
          <View style={st.fill}>
            {/* REG-800: tab bar di sistema (Liquid Glass su iOS 26). Voce spenta
                = tratto grigio, accesa = icona a colori originali (PNG da
                `tabIconArt`, patch di expo-router per non tingerli). Si
                rimpicciolisce quando si scorre in giù. */}
            <NativeTabs
              minimizeBehavior="onScrollDown"
              tintColor={TAB_LABEL_ON}
              labelStyle={{
                default: { color: TAB_ICON_OFF, fontSize: 10, fontWeight: '500' },
                selected: { color: TAB_LABEL_ON, fontSize: 10, fontWeight: '600' },
              }}
              badgeBackgroundColor={BADGE_RED}
            >
              {visibleTabs.map((name) => {
                const icon = TAB_ICON_PNG[tabIconKey(name, iconCtx)];
                return (
                  <NativeTabs.Trigger key={name} name={name}>
                    <Icon src={{ default: icon.off, selected: icon.on }} />
                    <Label>{titleFor(name)}</Label>
                    {name === 'inbox' && unreadCount > 0 ? (
                      <Badge>{unreadCount > 9 ? '9+' : String(unreadCount)}</Badge>
                    ) : null}
                  </NativeTabs.Trigger>
                );
              })}
            </NativeTabs>
            {instructorApp ? <NativeRoadMiniBar /> : null}
          </View>
          {overlay}
        </TabSceneContext.Provider>
      </QuizProvider>
    );
  }

  return (
    <QuizProvider>
    <TabSceneContext.Provider value={sceneInfo}>
      <Tabs
        // I titolari partono da «Oggi», tutti gli altri dalla home/Agenda.
        initialRouteName={ownerApp ? 'today' : 'home'}
        tabBar={(props) => barKind === 'none' ? null : (
          <AppTabBar
            {...props}
            isOwner={isOwner}
            ownerApp={ownerApp}
            isStudent={isStudent}
            isStudentTeoria={isStudentInTeoria}
            showMoreTab={showMoreTab}
            showRoleTab={showRoleTab}
            hiddenTabs={hiddenTabs}
            instructorApp={instructorApp}
          />
        )}
        screenOptions={({ route }) => {
          const underGlass =
            (instructorApp || ownerApp) && UNDER_GLASS_TABS.has(route.name) && topPageIsRoot((route as { state?: NestedState }).state);
          return {
            headerShown: false,
            tabBarHideOnKeyboard: true,
            // Senza barra (allievo con una voce sola) resta solo la safe area.
            sceneStyle: { paddingBottom: barKind === 'none' ? insets.bottom : underGlass ? 0 : tabBarHeight, backgroundColor: '#FFFFFF' },
          };
        }}
      >
        <Tabs.Screen name="today" options={{ href: ownerApp ? '/(tabs)/today' : null, title: 'Oggi' }} />
        <Tabs.Screen name="home" options={{ title: instructorApp || ownerApp ? 'Agenda' : 'Home' }} />
        <Tabs.Screen name="guide" options={{ href: showGuideTab ? '/(tabs)/guide' : null, title: 'Guide' }} />
        <Tabs.Screen name="swaps" options={{ href: showSwapsTab ? '/(tabs)/swaps' : null, title: 'Scambi' }} />
        <Tabs.Screen name="role" options={{ href: showRoleTab && !instructorApp && !ownerApp ? '/(tabs)/role' : null, title: isOwner ? 'Istruttore' : 'Disponibilità' }} />
        {/* Road montata in anticipo (fluidità 29/10): la mappa nasce a riposo
            dopo l'avvio, non al primo tocco. Solo per chi ha la tab. */}
        <Tabs.Screen name="drive" options={{ href: showDriveTab ? '/(tabs)/drive' : null, title: 'Road', lazy: !showDriveTab }} />
        <Tabs.Screen name="notes" options={{ href: showNotesTab ? '/(tabs)/notes' : null, title: showRoleTab ? 'Allievi' : 'Note' }} />
        <Tabs.Screen name="more" options={{ href: showMoreTab ? '/(tabs)/more' : null, title: instructorApp || ownerApp ? 'Tu' : 'Altro' }} />
        <Tabs.Screen name="settings" options={{ title: isStudent ? 'Profilo' : 'Impostazioni' }} />
        <Tabs.Screen name="quiz" options={{ href: showQuizTab ? '/(tabs)/quiz' : null, title: 'Quiz' }} />
        <Tabs.Screen name="inbox" options={{ href: showInboxTab ? '/(tabs)/inbox' : null, title: 'Notifiche' }} />
      </Tabs>
      {overlay}
    </TabSceneContext.Provider>
    </QuizProvider>
  );
}

const TAB_LABEL_ON = '#111111';
const BADGE_RED = '#C13515';

const st = StyleSheet.create({
  fill: { flex: 1 },
  miniWrap: { justifyContent: 'flex-end' },
});
