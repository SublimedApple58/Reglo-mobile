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
import { GlassTabBar } from '../../src/components/GlassTabBar';
import { isInstructor as isInstructorRole, isOwner as isOwnerRole, isStudent as isStudentRole } from '../../src/utils/roles';
import { isMotoLicenseCategory } from '../../src/utils/license';


/* ── Layout ── */

export default function TabsLayout() {
  const { autoscuolaRole } = useSession();
  const { enabled: swapEnabled } = useSwapEnabled();
  const { enabled: studentNotesEnabled } = useStudentNotesEnabled();
  const { enabled: vehiclesEnabled } = useVehiclesEnabled();
  const { enabled: quizEnabled } = useQuizEnabled();
  const { phase: studentPhase, hasQuizAccess, licenseCategory: studentLicenseCategory } = useStudentPhase();
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
  const showInboxTab =
    showRoleTab || (isStudent && !isStudentAwaiting && !isStudentLicensed);
  const isOwner = autoscuolaRole === 'OWNER';

  // Compute hidden tabs explicitly so the Android custom tab bar can
  // filter reliably (expo-router descriptors don't update reactively).
  const hiddenTabs = React.useMemo(() => {
    const set = new Set<string>();
    if (!showRoleTab) set.add('role');
    if (!showNotesTab) set.add('notes');
    if (!showMoreTab) set.add('more');
    if (!showQuizTab) set.add('quiz');
    if (!showInboxTab) set.add('inbox');
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
    isStudentAwaiting,
    isStudentLicensed,
  ]);

  return (
    <QuizProvider>
    <>
      <Tabs
        tabBar={(props) => (
          <GlassTabBar
            {...props}
            isOwner={isOwner}
            isStudent={isStudent}
            isStudentTeoria={isStudentInTeoria}
            isStudentMoto={isStudentMoto}
            showMoreTab={showMoreTab}
            showRoleTab={showRoleTab}
            hiddenTabs={hiddenTabs}
          />
        )}
        screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="role" options={{ href: showRoleTab ? '/(tabs)/role' : null, title: isOwner ? 'Istruttore' : 'Disponibilità' }} />
        <Tabs.Screen name="notes" options={{ href: showNotesTab ? '/(tabs)/notes' : null, title: showRoleTab ? 'Allievi' : 'Note' }} />
        <Tabs.Screen name="more" options={{ href: showMoreTab ? '/(tabs)/more' : null, title: 'Altro' }} />
        <Tabs.Screen name="settings" options={{ title: 'Impostazioni' }} />
        <Tabs.Screen name="quiz" options={{ href: showQuizTab ? '/(tabs)/quiz' : null, title: 'Quiz' }} />
        <Tabs.Screen name="inbox" options={{ href: showInboxTab ? '/(tabs)/inbox' : null, title: 'Notifiche' }} />
      </Tabs>
      <NotificationOverlay isStudent={isStudent} isInstructor={isInstructor} swapEnabled={swapEnabled} />
    </>
    </QuizProvider>
  );
}
