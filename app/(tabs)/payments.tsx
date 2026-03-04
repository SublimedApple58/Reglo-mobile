import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { useAutoPaymentsEnabled } from '../../src/hooks/useAutoPaymentsEnabled';
import { useLazyTabRender } from '../../src/hooks/useLazyTabRender';
import { AllievoPaymentsScreen } from '../../src/screens/AllievoPaymentsScreen';

export default function PaymentsRoute() {
  const { shouldRender, isFocused } = useLazyTabRender();

  if (!shouldRender) return null;

  return <PaymentsRouteContent isFocused={isFocused} />;
}

const PaymentsRouteContent = ({ isFocused }: { isFocused: boolean }) => {
  const { autoscuolaRole } = useSession();
  const { enabled: autoPaymentsEnabled, loading: autoPaymentsLoading } = useAutoPaymentsEnabled();
  const router = useRouter();
  const isStudent = autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR';
  const canAccess = isStudent && autoPaymentsEnabled;

  useEffect(() => {
    if (!isFocused) return;
    if (!autoPaymentsLoading && !canAccess) {
      router.replace('/(tabs)/home');
    }
  }, [autoPaymentsLoading, canAccess, isFocused, router]);

  if (autoPaymentsLoading || !canAccess) return null;
  return <AllievoPaymentsScreen />;
};
