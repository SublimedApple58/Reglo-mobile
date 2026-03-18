import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { OwnerVehiclesScreen } from '../../src/screens/OwnerVehiclesScreen';

export default function VehiclesRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (autoscuolaRole && autoscuolaRole !== 'OWNER') {
      router.replace('/(tabs)/home');
    }
  }, [autoscuolaRole, router]);

  if (autoscuolaRole === 'OWNER') return <OwnerVehiclesScreen />;
  return null;
}
