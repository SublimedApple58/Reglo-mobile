import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { OwnerInstructorScreen } from '../../src/screens/OwnerInstructorScreen';
import { InstructorManageScreen } from '../../src/screens/InstructorManageScreen';
import { RoleHomeScreen } from '../../src/screens/RoleHomeScreen';
import { useLazyTabRender } from '../../src/hooks/useLazyTabRender';

export default function RoleRoute() {
  const { shouldRender, isFocused } = useLazyTabRender();

  if (!shouldRender) return null;

  return <RoleRouteContent isFocused={isFocused} />;
}

const RoleRouteContent = ({ isFocused }: { isFocused: boolean }) => {
  const { autoscuolaRole } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isFocused) return;
    if (autoscuolaRole && autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR') {
      router.replace('/(tabs)/home');
    }
  }, [autoscuolaRole, isFocused, router]);

  if (autoscuolaRole === 'OWNER') return <OwnerInstructorScreen />;
  if (autoscuolaRole === 'INSTRUCTOR') return <InstructorManageScreen />;
  return <RoleHomeScreen />;
};
