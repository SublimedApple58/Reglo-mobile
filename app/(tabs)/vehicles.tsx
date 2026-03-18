import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { OwnerVehiclesScreen } from '../../src/screens/OwnerVehiclesScreen';
import { InstructorVehiclesScreen } from '../../src/screens/InstructorVehiclesScreen';

export default function VehiclesRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (autoscuolaRole && autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR') {
      router.replace('/(tabs)/home');
    }
  }, [autoscuolaRole, router]);

  if (autoscuolaRole === 'OWNER') return <OwnerVehiclesScreen />;
  if (autoscuolaRole === 'INSTRUCTOR') return <InstructorVehiclesScreen />;
  return null;
}
