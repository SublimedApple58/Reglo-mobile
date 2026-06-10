import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../../src/context/SessionContext';
import { OwnerInstructorScreen } from '../../../src/screens/OwnerInstructorScreen';
import { InstructorAvailabilityScreen } from '../../../src/screens/InstructorAvailabilityScreen';
import { RoleHomeScreen } from '../../../src/screens/RoleHomeScreen';
import { isInstructor, isOwner } from '../../../src/utils/roles';

export default function RoleRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (autoscuolaRole && !isOwner(autoscuolaRole) && !isInstructor(autoscuolaRole)) {
      router.replace('/(tabs)/home');
    }
  }, [autoscuolaRole, router]);

  if (autoscuolaRole === 'OWNER') return <OwnerInstructorScreen />;
  if (isInstructor(autoscuolaRole)) return <InstructorAvailabilityScreen />;
  return <RoleHomeScreen />;
}
