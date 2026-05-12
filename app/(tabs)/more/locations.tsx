import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../../src/context/SessionContext';
import { isInstructor, isOwner } from '../../../src/utils/roles';
import { LocationsScreen } from '../../../src/screens/LocationsScreen';

export default function LocationsRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (autoscuolaRole && !isOwner(autoscuolaRole) && !isInstructor(autoscuolaRole)) {
      router.replace('/(tabs)/home');
    }
  }, [autoscuolaRole, router]);

  if (!isOwner(autoscuolaRole) && !isInstructor(autoscuolaRole)) return null;
  return <LocationsScreen />;
}
