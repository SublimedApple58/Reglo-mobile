import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../../src/context/SessionContext';
import { isInstructor, isOwner } from '../../../src/utils/roles';
import { OwnerVehiclesScreen } from '../../../src/screens/OwnerVehiclesScreen';
import { InstructorVehiclesScreen } from '../../../src/screens/InstructorVehiclesScreen';

export default function VehiclesRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (autoscuolaRole && !isOwner(autoscuolaRole) && !isInstructor(autoscuolaRole)) {
      router.replace('/(tabs)/home');
    }
  }, [autoscuolaRole, router]);

  if (isOwner(autoscuolaRole)) return <OwnerVehiclesScreen />;
  if (isInstructor(autoscuolaRole)) return <InstructorVehiclesScreen />;
  return null;
}
