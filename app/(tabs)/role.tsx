import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { OwnerInstructorScreen } from '../../src/screens/OwnerInstructorScreen';
import { InstructorManageScreen } from '../../src/screens/InstructorManageScreen';
import { RoleHomeScreen } from '../../src/screens/RoleHomeScreen';

export default function RoleRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (autoscuolaRole && autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR') {
      router.replace('/(tabs)/home');
    }
  }, [autoscuolaRole, router]);

  if (autoscuolaRole === 'OWNER') return <OwnerInstructorScreen />;
  if (autoscuolaRole === 'INSTRUCTOR') return <InstructorManageScreen />;
  return <RoleHomeScreen />;
}
