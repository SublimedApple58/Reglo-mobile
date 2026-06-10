import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../../src/context/SessionContext';
import { GroupLessonInvitesScreen } from '../../../src/screens/GroupLessonInvitesScreen';

export default function GroupLessonInvitesRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();
  const isStudent = autoscuolaRole === 'STUDENT';

  useEffect(() => {
    if (!isStudent) router.replace('/(tabs)/home');
  }, [isStudent, router]);

  if (!isStudent) return null;
  return <GroupLessonInvitesScreen />;
}
