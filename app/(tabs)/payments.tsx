import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { useAutoPaymentsEnabled } from '../../src/hooks/useAutoPaymentsEnabled';
import { AllievoPaymentsScreen } from '../../src/screens/AllievoPaymentsScreen';

export default function PaymentsRoute() {
  const { autoscuolaRole } = useSession();
  const { enabled: autoPaymentsEnabled, loading: autoPaymentsLoading } = useAutoPaymentsEnabled();
  const router = useRouter();
  const isStudent = autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR';
  const canAccess = isStudent && autoPaymentsEnabled;

  useEffect(() => {
    if (!autoPaymentsLoading && !canAccess) {
      router.replace('/(tabs)/home');
    }
  }, [autoPaymentsLoading, canAccess, router]);

  if (autoPaymentsLoading || !canAccess) return null;
  return <AllievoPaymentsScreen />;
}
