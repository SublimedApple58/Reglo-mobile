import React from 'react';
import { Tabs } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { useSwapEnabled } from '../../src/hooks/useSwapEnabled';
import { useStudentNotesEnabled } from '../../src/hooks/useStudentNotesEnabled';
import { useVehiclesEnabled } from '../../src/hooks/useVehiclesEnabled';
import { useQuizEnabled } from '../../src/hooks/useQuizEnabled';
import { QuizProvider } from '../../src/context/QuizContext';
import { useStudentPhase } from '../../src/hooks/useStudentPhase';
import { NotificationOverlay } from '../../src/components/NotificationOverlay';
import { AppTabBar } from '../../src/components/AppTabBar';
import { PhoneGateScreen } from '../../src/screens/PhoneGateScreen';
import { LicensePathGateScreen } from '../../src/screens/LicensePathGateScreen';
import { isInstructor as isInstructorRole, isOwner as isOwnerRole, isStudent as isStudentRole } from '../../src/utils/roles';
import { isMotoLicenseCategory } from '../../src/utils/license';
import { useInstructorTabs } from '../../src/hooks/useInstructorTabs';
import { warmRoadFree } from '../../src/road/freeStartStore';
import { useTabBarHeight } from '../../src/components/tabBarSpace';

/**
 * Tab bar «B · vetro» (Tiziano 28/10): la barra sta sopra le schermate. Solo le
 * radici dell'app istruttore scorrono sotto il vetro (si tengono lo spazio da
 * sé, `useTabBarOverlap`); qualsiasi pagina a schermo pieno aperta sopra ha lo
 * spazio riservato qui. I fogli (form sheet, modali) non contano: aprirli non
 * cambia il layout della radice sotto.
 */
const UNDER_GLASS_TABS = new Set(['home', 'drive', 'notes', 'more']);
const FULL_PAGES = new Set([
  'availability', 'notifications', 'swaps', 'group-lesson-invites',
  'cluster-settings',
  // REG-646: punti critici nella tab Road.
  'punti-critici',
  'settings', 'appearance', 'instructor-hours', 'instructors-overview', 'locations', 'vehicles', 'evaluation-sheet',
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


/* ── Layout ── */

export default function TabsLayout() {
  const { autoscuolaRole, user, status } = useSession();
  const { enabled: swapEnabled } = useSwapEnabled();
  const { enabled: studentNotesEnabled } = useStudentNotesEnabled();
  const { enabled: vehiclesEnabled } = useVehiclesEnabled();
  const { enabled: quizEnabled } = useQuizEnabled();
  const { phase: studentPhase, hasQuizAccess, licenseCategory: studentLicenseCategory, needsLicensePath } = useStudentPhase();
  const showRoleTab = isOwnerRole(autoscuolaRole) || isInstructorRole(autoscuolaRole);
  const isStudent = isStudentRole(autoscuolaRole);
  const isInstructor = isInstructorRole(autoscuolaRole);
  const isInstructorOwner = autoscuolaRole === 'INSTRUCTOR_OWNER';
  const isStudentAwaiting = isStudent && studentPhase === 'AWAITING';
  const isStudentInTeoria = isStudent && studentPhase === 'TEORIA';
  const isStudentLicensed = isStudent && studentPhase === 'PATENTATO';
  const isStudentMoto = isStudent && isMotoLicenseCategory(studentLicenseCategory);
  // Students in AWAITING: only the home neutral screen — no functional tabs.
  // Students in PATENTATO: only home tab is visible.
  // Students in TEORIA: quiz central, no swaps.
  const showNotesTab =
    (showRoleTab || studentNotesEnabled) && !isStudentAwaiting && !isStudentLicensed && !isStudentInTeoria;
  // "Altro" tab: always for instructors (Ore di guida), vehicles + settings for OWNER
  const showMoreTab = isInstructor || isInstructorOwner || (showRoleTab && vehiclesEnabled);
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
  const showInboxTab =
    !instructorApp && (showRoleTab || (isStudent && !isStudentAwaiting && !isStudentLicensed));
  const isOwner = autoscuolaRole === 'OWNER';
  const tabBarHeight = useTabBarHeight();

  // Compute hidden tabs explicitly so the Android custom tab bar can
  // filter reliably (expo-router descriptors don't update reactively).
  const hiddenTabs = React.useMemo(() => {
    const set = new Set<string>();
    if (!showRoleTab || instructorApp) set.add('role');
    if (!showNotesTab) set.add('notes');
    if (!showMoreTab) set.add('more');
    if (!showQuizTab) set.add('quiz');
    if (!showInboxTab) set.add('inbox');
    if (!showDriveTab) set.add('drive');
    // Settings hidden when "Altro" is shown (accessed from More screen)
    if (showMoreTab) set.add('settings');
    // Awaiting / Licensed students see only home — no settings either.
    if (isStudentAwaiting || isStudentLicensed) set.add('settings');
    return set;
  }, [
    showRoleTab,
    showNotesTab,
    showMoreTab,
    showQuizTab,
    showInboxTab,
    showDriveTab,
    instructorApp,
    isStudentAwaiting,
    isStudentLicensed,
  ]);

  // Blocking gate: a student without a phone number can't use the app until
  // they add one (registration has required it for a while — this catches the
  // older accounts). Replaces the whole tab tree; only exits are save/logout.
  if (status === 'ready' && isStudent && !user?.phone?.trim()) {
    return <PhoneGateScreen />;
  }

  // Blocking gate: a student who registered in autonomy (self sign-up) must
  // pick their own percorso patente at first access (REG-410). Shown after the
  // phone gate; same rules — replaces the tab tree, only exits are confirm/logout.
  if (status === 'ready' && isStudent && needsLicensePath) {
    return <LicensePathGateScreen />;
  }

  return (
    <QuizProvider>
    <>
      <Tabs
        tabBar={(props) => (
          <AppTabBar
            {...props}
            isOwner={isOwner}
            isStudent={isStudent}
            isStudentTeoria={isStudentInTeoria}
            isStudentMoto={isStudentMoto}
            showMoreTab={showMoreTab}
            showRoleTab={showRoleTab}
            hiddenTabs={hiddenTabs}
            instructorApp={instructorApp}
          />
        )}
        screenOptions={({ route }) => {
          const underGlass =
            instructorApp && UNDER_GLASS_TABS.has(route.name) && topPageIsRoot((route as { state?: NestedState }).state);
          return {
            headerShown: false,
            tabBarHideOnKeyboard: true,
            sceneStyle: { paddingBottom: underGlass ? 0 : tabBarHeight, backgroundColor: '#FFFFFF' },
          };
        }}
      >
        <Tabs.Screen name="home" options={{ title: instructorApp ? 'Agenda' : 'Home' }} />
        <Tabs.Screen name="role" options={{ href: showRoleTab && !instructorApp ? '/(tabs)/role' : null, title: isOwner ? 'Istruttore' : 'Disponibilità' }} />
        {/* Road montata in anticipo (fluidità 29/10): la mappa nasce a riposo
            dopo l'avvio, non al primo tocco. Solo per chi ha la tab. */}
        <Tabs.Screen name="drive" options={{ href: showDriveTab ? '/(tabs)/drive' : null, title: 'Road', lazy: !showDriveTab }} />
        <Tabs.Screen name="notes" options={{ href: showNotesTab ? '/(tabs)/notes' : null, title: showRoleTab ? 'Allievi' : 'Note' }} />
        <Tabs.Screen name="more" options={{ href: showMoreTab ? '/(tabs)/more' : null, title: instructorApp ? 'Tu' : 'Altro' }} />
        <Tabs.Screen name="settings" options={{ title: 'Impostazioni' }} />
        <Tabs.Screen name="quiz" options={{ href: showQuizTab ? '/(tabs)/quiz' : null, title: 'Quiz' }} />
        <Tabs.Screen name="inbox" options={{ href: showInboxTab ? '/(tabs)/inbox' : null, title: 'Notifiche' }} />
      </Tabs>
      <NotificationOverlay
        isStudent={isStudent}
        isInstructor={isInstructor}
        isOwner={autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR_OWNER'}
        swapEnabled={swapEnabled}
      />
    </>
    </QuizProvider>
  );
}
