import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { InstructorNotesScreen } from '../../src/screens/InstructorNotesScreen';

export default function NotesRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (autoscuolaRole && autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR') {
      router.replace('/(tabs)/home');
    }
  }, [autoscuolaRole, router]);

  return <InstructorNotesScreen />;
}
